#!/usr/bin/env bash
# Egonetics Phase 1 — L0/L1/L2 user isolation setup
#
# 做三件事：
#   1. 把 prvse_world_workspace 从 ~/Desktop 移到 /Users/Shared (macOS) 或
#      /srv/egonetics (Linux)，原位置留软链接
#   2. 创建 3 个服务用户 egonetics-l{0,1,2} 和 3 个 group
#   3. 设置 L0/L1/L2 目录的分层组权限
#   4. 安装 sudoers 规则，允许 bornfly 以 egonetics-lX 身份跑 tmux
#   5. 自动验证（创建 test-marker，用每个身份尝试读取）
#
# 幂等：可以重复跑
# 双平台：Darwin (macOS) + Linux 自动适配
#
# Usage:
#   sudo bash scripts/setup-egonetics-users.sh --dry-run   # 预览
#   sudo bash scripts/setup-egonetics-users.sh             # 正式执行
#   sudo bash scripts/setup-egonetics-users.sh --rollback  # 撤销

set -euo pipefail

# ── Config ─────────────────────────────────────────────────────────
ADMIN_USER="${EGONETICS_ADMIN_USER:-bornfly}"
PLATFORM=$(uname)
WORKSPACE_SRC_HINT="/Users/bornfly/Desktop/claude_code_learn/prvse_world_workspace"

case "$PLATFORM" in
  Darwin)
    WORKSPACE_DST="/Users/Shared/prvse_world_workspace"
    SERVICE_HOME_BASE="/var/egonetics"
    ;;
  Linux)
    WORKSPACE_DST="/srv/egonetics/prvse_world_workspace"
    SERVICE_HOME_BASE="/var/lib/egonetics"
    ;;
  *)
    echo "ERROR: unsupported platform: $PLATFORM" >&2
    exit 1
    ;;
esac

DRY_RUN=0
ROLLBACK=0
for arg in "${@:-}"; do
  case "$arg" in
    --dry-run)  DRY_RUN=1 ;;
    --rollback) ROLLBACK=1 ;;
    -h|--help)
      sed -n '2,25p' "$0"
      exit 0
      ;;
  esac
done

# ── Output helpers ─────────────────────────────────────────────────
c_grn='\033[0;32m'; c_ylw='\033[0;33m'; c_red='\033[0;31m'; c_bld='\033[1m'; c_rst='\033[0m'
ok()   { echo -e "  ${c_grn}✓${c_rst} $*"; }
skip() { echo -e "  ${c_ylw}·${c_rst} $*"; }
warn() { echo -e "  ${c_ylw}!${c_rst} $*"; }
fail() { echo -e "  ${c_red}✗${c_rst} $*"; }
hdr()  { echo; echo -e "${c_bld}── $* ──${c_rst}"; }
die()  { fail "$*"; exit 1; }

run() {
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "  [dry-run] $*"
  else
    eval "$@"
  fi
}

# ── Root check ─────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  die "must run with sudo (EUID=$EUID)"
fi

echo -e "${c_bld}Egonetics Phase 1 Setup${c_rst}"
echo "Platform     : $PLATFORM"
echo "Admin user   : $ADMIN_USER"
echo "Workspace dst: $WORKSPACE_DST"
echo "Service home : $SERVICE_HOME_BASE"
[[ $DRY_RUN  -eq 1 ]] && warn "DRY-RUN mode (no changes will be made)"
[[ $ROLLBACK -eq 1 ]] && warn "ROLLBACK mode"
echo

# ── Platform-specific primitives ───────────────────────────────────
create_group() {
  local name="$1" gid="$2"
  if [[ "$PLATFORM" == "Darwin" ]]; then
    if dscl . -read "/Groups/${name}" >/dev/null 2>&1; then
      skip "group ${name} already exists"
      return
    fi
    run "dscl . -create /Groups/${name}"
    run "dscl . -create /Groups/${name} PrimaryGroupID ${gid}"
    run "dscl . -create /Groups/${name} RealName 'Egonetics ${name}'"
  else
    if getent group "${name}" >/dev/null 2>&1; then
      skip "group ${name} already exists"
      return
    fi
    run "groupadd -r -g ${gid} ${name}"
  fi
  ok "created group ${name} (gid ${gid})"
}

create_user() {
  local name="$1" uid="$2" gid="$3" home="$4"
  if [[ "$PLATFORM" == "Darwin" ]]; then
    if dscl . -read "/Users/${name}" >/dev/null 2>&1; then
      skip "user ${name} already exists"
      return
    fi
    run "dscl . -create /Users/${name}"
    run "dscl . -create /Users/${name} UniqueID ${uid}"
    run "dscl . -create /Users/${name} PrimaryGroupID ${gid}"
    run "dscl . -create /Users/${name} UserShell /usr/bin/false"
    run "dscl . -create /Users/${name} NFSHomeDirectory ${home}"
    run "dscl . -create /Users/${name} RealName 'Egonetics ${name}'"
    run "dscl . -create /Users/${name} IsHidden 1"
  else
    if id -u "${name}" >/dev/null 2>&1; then
      skip "user ${name} already exists"
      return
    fi
    run "useradd -r -u ${uid} -g ${gid} -s /usr/sbin/nologin -d ${home} -M ${name}"
  fi
  ok "created user ${name} (uid ${uid}, home ${home})"
}

add_supp_group() {
  local user="$1" group="$2"
  if [[ "$PLATFORM" == "Darwin" ]]; then
    # dseditgroup is idempotent but may warn — squelch
    run "dseditgroup -o edit -a ${user} -t user ${group} >/dev/null 2>&1 || true"
  else
    run "usermod -aG ${group} ${user}"
  fi
  ok "${user} ∈ ${group}"
}

delete_user() {
  local name="$1"
  if [[ "$PLATFORM" == "Darwin" ]]; then
    if dscl . -read "/Users/${name}" >/dev/null 2>&1; then
      run "dscl . -delete /Users/${name}"
      ok "deleted user ${name}"
    fi
  else
    if id -u "${name}" >/dev/null 2>&1; then
      run "userdel ${name}"
      ok "deleted user ${name}"
    fi
  fi
}

delete_group() {
  local name="$1"
  if [[ "$PLATFORM" == "Darwin" ]]; then
    if dscl . -read "/Groups/${name}" >/dev/null 2>&1; then
      run "dscl . -delete /Groups/${name}"
      ok "deleted group ${name}"
    fi
  else
    if getent group "${name}" >/dev/null 2>&1; then
      run "groupdel ${name}"
      ok "deleted group ${name}"
    fi
  fi
}

# ── Rollback ───────────────────────────────────────────────────────
if [[ $ROLLBACK -eq 1 ]]; then
  hdr "ROLLBACK"
  run "rm -f /etc/sudoers.d/egonetics"
  for level in 0 1 2; do
    delete_user  "egonetics-l${level}"
    delete_group "egonetics-l${level}"
  done
  warn "workspace location NOT reverted — manual move if needed:"
  echo "    sudo mv ${WORKSPACE_DST} ${WORKSPACE_SRC_HINT}"
  echo "    rm ${WORKSPACE_SRC_HINT}   # if it became a symlink"
  exit 0
fi

# ── Phase 1: Move workspace ────────────────────────────────────────
hdr "Phase 1 — Move workspace to ${WORKSPACE_DST}"

if [[ -L "${WORKSPACE_SRC_HINT}" ]]; then
  current_target=$(readlink "${WORKSPACE_SRC_HINT}")
  if [[ "${current_target}" == "${WORKSPACE_DST}" ]]; then
    skip "symlink already points to ${WORKSPACE_DST}"
  else
    die "symlink at ${WORKSPACE_SRC_HINT} points elsewhere: ${current_target}"
  fi
elif [[ -d "${WORKSPACE_DST}" ]]; then
  skip "destination ${WORKSPACE_DST} already exists"
  if [[ -e "${WORKSPACE_SRC_HINT}" ]]; then
    die "both old and new exist — manual intervention: rm ${WORKSPACE_SRC_HINT} && ln -s ${WORKSPACE_DST} ${WORKSPACE_SRC_HINT}"
  fi
  # Create symlink
  run "ln -s ${WORKSPACE_DST} ${WORKSPACE_SRC_HINT}"
  run "chown -h ${ADMIN_USER}:staff ${WORKSPACE_SRC_HINT}"
  ok "created symlink ${WORKSPACE_SRC_HINT} → ${WORKSPACE_DST}"
elif [[ -d "${WORKSPACE_SRC_HINT}" ]]; then
  run "mkdir -p $(dirname ${WORKSPACE_DST})"
  run "mv ${WORKSPACE_SRC_HINT} ${WORKSPACE_DST}"
  run "ln -s ${WORKSPACE_DST} ${WORKSPACE_SRC_HINT}"
  run "chown -h ${ADMIN_USER}:staff ${WORKSPACE_SRC_HINT}"
  ok "moved workspace → ${WORKSPACE_DST} + created symlink"
else
  die "neither ${WORKSPACE_SRC_HINT} nor ${WORKSPACE_DST} exists"
fi

for level in L0 L1 L2; do
  run "mkdir -p ${WORKSPACE_DST}/${level}"
done

# ── Phase 2: Groups ────────────────────────────────────────────────
hdr "Phase 2 — Create groups"
create_group "egonetics-l0" 601
create_group "egonetics-l1" 602
create_group "egonetics-l2" 603

# ── Phase 3: Service users + homes ─────────────────────────────────
hdr "Phase 3 — Create service users"
run "mkdir -p ${SERVICE_HOME_BASE}"
run "chmod 755 ${SERVICE_HOME_BASE}"

create_user "egonetics-l0" 601 601 "${SERVICE_HOME_BASE}/l0-home"
create_user "egonetics-l1" 602 602 "${SERVICE_HOME_BASE}/l1-home"
create_user "egonetics-l2" 603 603 "${SERVICE_HOME_BASE}/l2-home"

for level in 0 1 2; do
  home="${SERVICE_HOME_BASE}/l${level}-home"
  user="egonetics-l${level}"
  run "mkdir -p ${home}"
  run "chown ${user}:egonetics-l${level} ${home}"
  run "chmod 700 ${home}"
done

# ── Phase 4: Supplementary group hierarchy ─────────────────────────
hdr "Phase 4 — Supplementary group hierarchy"
# L2 ⊇ L1 ⊇ L0
add_supp_group "egonetics-l1" "egonetics-l0"
add_supp_group "egonetics-l2" "egonetics-l0"
add_supp_group "egonetics-l2" "egonetics-l1"
# Admin ∈ all three (for owner-independent access via group)
add_supp_group "${ADMIN_USER}" "egonetics-l0"
add_supp_group "${ADMIN_USER}" "egonetics-l1"
add_supp_group "${ADMIN_USER}" "egonetics-l2"

# ── Phase 5: Workspace permissions ─────────────────────────────────
hdr "Phase 5 — Set workspace permissions"

run "chown ${ADMIN_USER}:staff ${WORKSPACE_DST}"
run "chmod 755 ${WORKSPACE_DST}"

for level in 0 1 2; do
  dir="${WORKSPACE_DST}/L${level}"
  group="egonetics-l${level}"
  run "chown -R ${ADMIN_USER}:${group} ${dir}"
  # setgid + group rwx, no other
  run "find ${dir} -type d -exec chmod 2770 {} +"
  run "find ${dir} -type f -exec chmod 660 {} +"
  ok "L${level}: ${ADMIN_USER}:${group}, 2770/660"
done

# ── Phase 6: Sudoers ───────────────────────────────────────────────
hdr "Phase 6 — Install sudoers rule"

SUDOERS_FILE="/etc/sudoers.d/egonetics"
TMUX_BIN=$(command -v tmux 2>/dev/null || echo "")
if [[ -z "${TMUX_BIN}" ]] || [[ ! -x "${TMUX_BIN}" ]]; then
  die "tmux not found in PATH — install tmux first"
fi

if [[ $DRY_RUN -eq 1 ]]; then
  echo "  [dry-run] would write ${SUDOERS_FILE} allowing ${ADMIN_USER} to run ${TMUX_BIN} as egonetics-l{0,1,2}"
else
  # Write to tmp file, validate with visudo, then atomic move
  TMP_SUDOERS=$(mktemp)
  cat > "${TMP_SUDOERS}" <<EOF
# Egonetics harness spawning — auto-generated, do not edit
# Generated by scripts/setup-egonetics-users.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)
${ADMIN_USER} ALL=(egonetics-l0) NOPASSWD: ${TMUX_BIN}
${ADMIN_USER} ALL=(egonetics-l1) NOPASSWD: ${TMUX_BIN}
${ADMIN_USER} ALL=(egonetics-l2) NOPASSWD: ${TMUX_BIN}
EOF
  chmod 0440 "${TMP_SUDOERS}"
  if visudo -c -f "${TMP_SUDOERS}" >/dev/null 2>&1; then
    mv "${TMP_SUDOERS}" "${SUDOERS_FILE}"
    chown root:wheel "${SUDOERS_FILE}" 2>/dev/null || chown root:root "${SUDOERS_FILE}"
    ok "installed ${SUDOERS_FILE} (tmux=${TMUX_BIN})"
  else
    rm -f "${TMP_SUDOERS}"
    die "sudoers syntax validation failed"
  fi
fi

# ── Phase 7: Verification ──────────────────────────────────────────
hdr "Phase 7 — Verification"

if [[ $DRY_RUN -eq 1 ]]; then
  warn "skipping verification in dry-run mode"
  exit 0
fi

# Create test markers at each level
for level in 0 1 2; do
  marker="${WORKSPACE_DST}/L${level}/.egonetics-test-marker"
  echo "L${level}-marker-$(date +%s)" > "${marker}"
  chown "${ADMIN_USER}:egonetics-l${level}" "${marker}"
  chmod 660 "${marker}"
done

pass=0
fail=0
verify() {
  local desc="$1" cmd="$2" expect="$3"
  local actual
  if eval "$cmd" >/dev/null 2>&1; then actual="ok"; else actual="err"; fi
  if [[ "$actual" == "$expect" ]]; then
    ok "${desc}"
    pass=$((pass+1))
  else
    fail "${desc} (expected ${expect}, got ${actual})"
    fail=$((fail+1))
  fi
}

# L0 user — reads only L0
verify "L0 user reads L0"    "sudo -n -u egonetics-l0 cat ${WORKSPACE_DST}/L0/.egonetics-test-marker" "ok"
verify "L0 user blocks L1"   "sudo -n -u egonetics-l0 cat ${WORKSPACE_DST}/L1/.egonetics-test-marker" "err"
verify "L0 user blocks L2"   "sudo -n -u egonetics-l0 cat ${WORKSPACE_DST}/L2/.egonetics-test-marker" "err"

# L1 user — reads L0 + L1
verify "L1 user reads L0"    "sudo -n -u egonetics-l1 cat ${WORKSPACE_DST}/L0/.egonetics-test-marker" "ok"
verify "L1 user reads L1"    "sudo -n -u egonetics-l1 cat ${WORKSPACE_DST}/L1/.egonetics-test-marker" "ok"
verify "L1 user blocks L2"   "sudo -n -u egonetics-l1 cat ${WORKSPACE_DST}/L2/.egonetics-test-marker" "err"

# L2 user — reads all
verify "L2 user reads L0"    "sudo -n -u egonetics-l2 cat ${WORKSPACE_DST}/L0/.egonetics-test-marker" "ok"
verify "L2 user reads L1"    "sudo -n -u egonetics-l2 cat ${WORKSPACE_DST}/L1/.egonetics-test-marker" "ok"
verify "L2 user reads L2"    "sudo -n -u egonetics-l2 cat ${WORKSPACE_DST}/L2/.egonetics-test-marker" "ok"

# Cross-isolation: cannot traverse bornfly's private dirs
if [[ -d "/Users/${ADMIN_USER}/.ssh" ]]; then
  verify "L0 user blocked from bornfly .ssh" \
    "sudo -n -u egonetics-l0 ls /Users/${ADMIN_USER}/.ssh/" "err"
fi

# tmux spawn sanity check
verify "sudo -u egonetics-l2 tmux -V works" \
  "sudo -n -u egonetics-l2 ${TMUX_BIN} -V" "ok"

# Cleanup test markers
for level in 0 1 2; do
  rm -f "${WORKSPACE_DST}/L${level}/.egonetics-test-marker"
done

# ── Summary ────────────────────────────────────────────────────────
echo
if [[ $fail -eq 0 ]]; then
  echo -e "${c_grn}${c_bld}✅ Phase 1 setup complete — ${pass} checks passed${c_rst}"
  echo
  echo "Next steps:"
  echo "  1. Verify workspace symlink:"
  echo "       ls -la ${WORKSPACE_SRC_HINT}"
  echo "  2. Restart Egonetics backend after code changes land"
  echo "  3. Tell assistant: Phase 1 setup succeeded"
  exit 0
else
  echo -e "${c_red}${c_bld}❌ ${fail} check(s) failed out of $((pass+fail))${c_rst}"
  echo
  echo "Review errors above. If stuck, run with --rollback to undo, then diagnose."
  exit 1
fi
