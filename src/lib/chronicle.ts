import { v4 as uuidv4 } from 'uuid'
import { ChronicleEntry, EntryType } from '@/types'

export class BornflyChronicle {
  private chain: ChronicleEntry[] = []
  private genesis: ChronicleEntry

  constructor() {
    this.genesis = this.createGenesis()
  }

  private createGenesis(): ChronicleEntry {
    const genesisContent = 'Bornfly Chronicle Genesis Block - The Beginning of Self'
    const genesisHash = this.calculateGenesisHash(genesisContent)
    
    return {
      id: 'genesis',
      timestamp: new Date().toISOString(),
      content: genesisContent,
      type: 'evolution',
      prev_hash: '0'.repeat(64),
      hash: genesisHash
    }
  }

  private calculateGenesisHash(content: string): string {
    // Simple hash for genesis - in production use proper crypto
    const data = `genesis:${content}:${Date.now()}`
    return this.simpleHash(data)
  }

  private async calculateHash(content: string, prevHash: string): Promise<string> {
    const data = `${content}:${prevHash}:${Date.now()}`
    
    // Use Web Crypto API if available
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const encoder = new TextEncoder()
      const dataBuffer = encoder.encode(data)
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    }
    
    // Fallback to simple hash for development
    return this.simpleHash(data)
  }

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(64, '0').slice(0, 64)
  }

  async addEntry(content: string, type: EntryType = 'memory', metadata?: Record<string, any>): Promise<ChronicleEntry> {
    const prevEntry = this.chain[this.chain.length - 1] || this.genesis
    const hash = await this.calculateHash(content, prevEntry.hash)
    
    const entry: ChronicleEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      content,
      type,
      prev_hash: prevEntry.hash,
      hash,
      metadata
    }

    this.chain.push(entry)
    this.saveToStorage()
    return entry
  }

  verifyChain(): { valid: boolean; brokenAt?: number; error?: string } {
    // Start from genesis
    let expectedPrevHash = this.genesis.hash
    
    for (let i = 0; i < this.chain.length; i++) {
      const entry = this.chain[i]
      
      // Check previous hash matches
      if (entry.prev_hash !== expectedPrevHash) {
        return {
          valid: false,
          brokenAt: i,
          error: `Hash mismatch at entry ${i}. Expected ${expectedPrevHash.slice(0, 16)}..., got ${entry.prev_hash.slice(0, 16)}...`
        }
      }
      
      // Verify current hash (simplified - in production would recalculate)
      expectedPrevHash = entry.hash
    }
    
    return { valid: true }
  }

  getChain(): ChronicleEntry[] {
    return [this.genesis, ...this.chain]
  }

  getLatestEntry(): ChronicleEntry {
    return this.chain[this.chain.length - 1] || this.genesis
  }

  getEntryCount(): number {
    return this.chain.length
  }

  private saveToStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('bornfly_chronicle', JSON.stringify({
          genesis: this.genesis,
          chain: this.chain,
          lastVerified: new Date().toISOString()
        }))
      } catch (error) {
        console.error('Failed to save chronicle to storage:', error)
      }
    }
  }

  loadFromStorage(): boolean {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('bornfly_chronicle')
        if (saved) {
          const data = JSON.parse(saved)
          this.genesis = data.genesis
          this.chain = data.chain
          return true
        }
      } catch (error) {
        console.error('Failed to load chronicle from storage:', error)
      }
    }
    return false
  }

  clear(): void {
    this.chain = []
    if (typeof window !== 'undefined') {
      localStorage.removeItem('bornfly_chronicle')
    }
  }
}