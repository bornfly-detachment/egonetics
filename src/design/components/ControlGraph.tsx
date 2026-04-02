/**
 * ControlGraph — 控制论执行图 (5节点 pentagon SVG)
 * Nodes: 感知(PARSE)→决策(COMPILE)→执行(CHECK)→评价(TEST)→反馈(INTEGRATE)
 * Design: Dark OLED + Real-Time Monitoring
 */

export type NodeStatus = 'idle' | 'running' | 'passed' | 'failed'

export interface ControlGraphProps {
  nodeStates?: Record<string, NodeStatus>
  className?: string
}

const R  = 85   // pentagon radius
const CX = 150  // center x
const CY = 130  // center y

const NODES = [
  { id: 'parse',        label: '感知', sub: 'PARSE',     n: 1, angle: -90  },
  { id: 'compile',      label: '决策', sub: 'COMPILE',   n: 2, angle: -18  },
  { id: 'schema_check', label: '执行', sub: 'CHECK',     n: 3, angle:  54  },
  { id: 'test_run',     label: '评价', sub: 'TEST',      n: 4, angle: 126  },
  { id: 'integrate',    label: '反馈', sub: 'INTEGRATE', n: 5, angle: 198  },
]

function nodePos(angle: number) {
  const rad = (angle * Math.PI) / 180
  return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) }
}

const STATUS: Record<NodeStatus, { ring: string; fill: string; text: string }> = {
  idle:    { ring: '#ffffff15', fill: '#0d1117', text: '#ffffff25' },
  running: { ring: '#fbbf24',   fill: '#1a1500', text: '#fbbf24'  },
  passed:  { ring: '#34d399',   fill: '#001a0f', text: '#34d399'  },
  failed:  { ring: '#f87171',   fill: '#1a0000', text: '#f87171'  },
}

export function ControlGraph({ nodeStates = {}, className = '' }: ControlGraphProps) {
  const positions = NODES.map(n => ({ ...n, ...nodePos(n.angle) }))

  return (
    <svg viewBox="0 0 300 260" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Pentagon edges */}
      {positions.map((node, i) => {
        const next   = positions[(i + 1) % positions.length]
        const active = (nodeStates[node.id] ?? 'idle') === 'passed'
        return (
          <line
            key={`edge-${i}`}
            x1={node.x} y1={node.y}
            x2={next.x} y2={next.y}
            stroke={active ? '#ffffff18' : '#ffffff08'}
            strokeWidth={active ? 1.5 : 1}
            strokeDasharray={active ? 'none' : '4 4'}
          />
        )
      })}

      {/* Center label */}
      <text x={CX} y={CY - 7}  textAnchor="middle" fill="#ffffff12" fontSize={8} fontFamily="JetBrains Mono,monospace">CONTROL</text>
      <text x={CX} y={CY + 5}  textAnchor="middle" fill="#ffffff12" fontSize={8} fontFamily="JetBrains Mono,monospace">GRAPH</text>

      {/* Nodes */}
      {positions.map(node => {
        const status  = nodeStates[node.id] ?? 'idle'
        const col     = STATUS[status]
        const r       = 26

        return (
          <g key={node.id}>
            {/* Pulse ring when running */}
            {status === 'running' && (
              <circle cx={node.x} cy={node.y} r={r + 4} fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.4">
                <animate attributeName="r"       values={`${r+4};${r+10};${r+4}`} dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0.05;0.4"            dur="1.5s" repeatCount="indefinite" />
              </circle>
            )}

            {/* Node body */}
            <circle cx={node.x} cy={node.y} r={r} fill={col.fill} stroke={col.ring} strokeWidth="1.5" />

            {/* Step number */}
            <text x={node.x} y={node.y - 9} textAnchor="middle" fill={col.text} fontSize={8}
              fontFamily="JetBrains Mono,monospace" opacity={0.55}>S{node.n}</text>

            {/* Chinese label */}
            <text x={node.x} y={node.y + 4} textAnchor="middle" fill={col.text} fontSize={13}
              fontWeight="bold" fontFamily="system-ui,sans-serif">{node.label}</text>

            {/* English sub */}
            <text x={node.x} y={node.y + 16} textAnchor="middle" fill={col.text} fontSize={7}
              fontFamily="JetBrains Mono,monospace" opacity={0.6}>{node.sub}</text>
          </g>
        )
      })}
    </svg>
  )
}
