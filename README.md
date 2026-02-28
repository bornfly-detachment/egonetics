# Egonetics - Bornfly's Life Core Interface

A personal agent system with tamper-evident chronicle, Bornfly Theory integration, and multi-agent coordination.

## 🎯 Philosophy

Egonetics (Ego + Cybernetics) is a system for maintaining **self-anchored continuity** through cryptographically linked records of evolution, decisions, and memories.

### Core Concepts

- **Bornfly Theory**: Core value judgment framework
- **Bornfly Chronicle**: Tamper-evident record of self-evolution
- **Egonetics**: Principles ensuring alignment with user intent
- **Life Core**: Central orchestrator agent

## 🚀 Features

### ✅ Implemented
- **Hash Chain Chronicle**: Append-only, cryptographically linked entries
- **Tamper Detection**: Automatic chain integrity verification
- **Entry Types**: Memory, Decision, Evolution, Principle, Task
- **Task Management**: Create, track, and coordinate work
- **Modern UI**: Dark theme with glassmorphism effects
- **Local Storage**: Persistent chronicle using IndexedDB

### 🔄 In Progress
- Agent spawning and coordination
- Bornfly Theory editor
- Egonetics principles management
- Multi-device sync

### 📋 Planned
- OpenClaw integration for agent execution
- External anchoring (Bitcoin/Ethereum)
- End-to-end encryption
- Mobile apps (Tauri/Capacitor)

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Glassmorphism
- **State**: Zustand with persistence
- **Cryptography**: Web Crypto API (SHA-256)
- **Icons**: Lucide React
- **Dates**: date-fns

## 📦 Installation

```bash
# Clone repository
git clone https://github.com/bornfly-detachment/egonetics.git
cd egonetics

# Install dependencies
npm install

# Start development server
npm run dev
```

## 🏗️ Project Structure

```
egonetics/
├── src/
│   ├── components/     # React components
│   │   ├── Sidebar.tsx
│   │   ├── ChronicleView.tsx
│   │   └── TasksView.tsx
│   ├── lib/           # Core logic
│   │   └── chronicle.ts  # Hash chain implementation
│   ├── stores/        # State management
│   │   └── useChronicleStore.ts
│   ├── types/         # TypeScript definitions
│   └── App.tsx        # Main application
├── public/            # Static assets
└── package.json       # Dependencies
```

## 🔐 Hash Chain Implementation

The Bornfly Chronicle uses a simple but effective hash chain:

```typescript
// Each entry includes:
{
  id: string,
  timestamp: string,
  content: string,
  type: EntryType,
  prev_hash: string,    // Hash of previous entry
  hash: string          // SHA256(timestamp + content + prev_hash)
}
```

**Properties:**
- Append-only: No deletions or modifications
- Tamper-evident: Any change breaks subsequent hashes
- Self-verifying: Chain integrity can be verified locally
- Optional signatures: Future-proof for digital signatures

## 🎨 UI Components

### Chronicle View
- Add new entries with type classification
- Visual hash chain display
- Real-time integrity verification
- Chronological timeline

### Tasks View
- Create and manage tasks
- Priority levels (Low → Critical)
- Status tracking (Pending → Completed)
- Agent spawning capability

### Sidebar
- Navigation between views
- Chain statistics
- Quick verification
- Responsive design

## 🚀 Development

```bash
# Development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Format code
npm run format
```

## 📱 Cross-Platform Support

Built with cross-platform in mind:
- **Web**: Primary interface (React)
- **Desktop**: Tauri wrapper (planned)
- **Mobile**: Capacitor wrapper (planned)

## 🔮 Future Development

### Phase 1 (Current)
- [x] Basic hash chain implementation
- [x] Chronicle UI
- [x] Task management
- [ ] Agent coordination UI

### Phase 2
- [ ] OpenClaw integration
- [ ] Bornfly Theory editor
- [ ] Egonetics principles
- [ ] External anchoring

### Phase 3
- [ ] End-to-end encryption
- [ ] Multi-device sync
- [ ] Advanced analytics
- [ ] Plugin system

## 🤝 Contributing

This is a personal project by Bornfly, but suggestions are welcome.

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- Inspired by Git's commit chain
- Blockchain concepts for personal use
- Cybernetics and systems theory
- Personal knowledge management systems

---

**Egonetics** - Your digital self, anchored in time. ⚓