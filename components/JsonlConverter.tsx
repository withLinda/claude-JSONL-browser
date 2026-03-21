'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  FileText, Copy, CheckCircle, Upload, Download, X,
  Search, ChevronRight, ChevronDown, Menu, File,
  FolderOpen, FolderPlus, Trash2, AlertCircle, Edit2,
  ArrowUpDown, Calendar, Type, HardDrive, Check
} from 'lucide-react'
import { 
  cn, formatFileSize, formatFileDate, generateFileId,
  decodeJsonString, normalizeToMarkdown, extractHeredocContent,
  formatToolInput, formatMarkdownContent
} from '@/lib/utils'

// TypeScript interfaces for JSONL message structures
interface MessageContent {
  type: 'text' | 'tool_use' | string
  text?: string
  name?: string
  id?: string
  input?: any
  tool_use_id?: string
  content?: any
  [key: string]: any
}

interface Message {
  type: 'user' | 'assistant' | 'summary'
  message?: {
    content: string | MessageContent[] | Record<string, any>
    role?: string
  }
  created?: string
  timestamp?: string
  summary?: string
  sessionId?: string
  gitBranch?: string
  cwd?: string
}

interface FileData {
  id: string
  name: string
  content: string
  markdown: string | null
  lastModified: number
  size: number
  converted: boolean
  error?: string
}

interface SearchResult {
  matches: number
  snippets: Array<{
    lineNumber: number
    text: string
  }>
}

interface FolderEntry {
  id: string
  name: string
  addedAt: number
}

const FOLDERS_STORAGE_KEY = 'jsonl-browser-folders'
const DB_NAME = 'jsonl-browser'
const DB_STORE = 'folder-handles'

function openHandlesDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveFolderHandle(id: string, handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openHandlesDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite')
    tx.objectStore(DB_STORE).put(handle, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function getFolderHandle(id: string): Promise<FileSystemDirectoryHandle | null> {
  const db = await openHandlesDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly')
    const req = tx.objectStore(DB_STORE).get(id)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

async function removeFolderHandle(id: string): Promise<void> {
  const db = await openHandlesDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite')
    tx.objectStore(DB_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export default function JsonlConverter() {
  const [files, setFiles] = useState<FileData[]>([])
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [searchResults, setSearchResults] = useState<Record<string, SearchResult>>({})
  const [sortOrder, setSortOrder] = useState<string>('date-desc')
  const [editingFileId, setEditingFileId] = useState<string | null>(null)
  const [editingFileName, setEditingFileName] = useState('')
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false)
  const [jsonlExpanded, setJsonlExpanded] = useState(false)
  const [folders, setFolders] = useState<FolderEntry[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  // Detect screen size
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth
      setIsMobile(width < 640)
      if (width < 640) {
        setSidebarOpen(false)
      }
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Load persisted folders from localStorage on mount
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(FOLDERS_STORAGE_KEY) || '[]')
      setFolders(stored)
    } catch {
      // ignore malformed storage
    }
  }, [])

  // Focus input when editing starts
  useEffect(() => {
    if (editingFileId && editInputRef.current) {
      editInputRef.current.focus()
      const lastDotIndex = editInputRef.current.value.lastIndexOf('.')
      if (lastDotIndex > 0) {
        editInputRef.current.setSelectionRange(0, lastDotIndex)
      } else {
        editInputRef.current.select()
      }
    }
  }, [editingFileId])

  // Search functionality
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults({})
      return
    }

    const results: Record<string, SearchResult> = {}
    const searchLower = searchTerm.toLowerCase()
    
    files.forEach(file => {
      let matches = 0
      const snippets: SearchResult['snippets'] = []
      
      if (file.name.toLowerCase().includes(searchLower)) {
        matches++
      }
      
      if (file.content) {
        const lines = file.content.split('\n')
        lines.forEach((line, idx) => {
          if (line.toLowerCase().includes(searchLower)) {
            matches++
            if (snippets.length < 3) {
              snippets.push({
                lineNumber: idx + 1,
                text: line.substring(0, 100) + (line.length > 100 ? '...' : '')
              })
            }
          }
        })
      }
      
      if (file.markdown) {
        const mdLines = file.markdown.split('\n')
        mdLines.forEach(line => {
          if (line.toLowerCase().includes(searchLower)) {
            matches++
          }
        })
      }
      
      if (matches > 0) {
        results[file.id] = { matches, snippets }
      }
    })
    
    setSearchResults(results)
  }, [searchTerm, files])

  const getSortedFiles = () => {
    const filesCopy = [...files]
    
    switch (sortOrder) {
      case 'date-desc':
        return filesCopy.sort((a, b) => b.lastModified - a.lastModified)
      case 'date-asc':
        return filesCopy.sort((a, b) => a.lastModified - b.lastModified)
      case 'name-asc':
        return filesCopy.sort((a, b) => a.name.localeCompare(b.name))
      case 'name-desc':
        return filesCopy.sort((a, b) => b.name.localeCompare(a.name))
      case 'size-desc':
        return filesCopy.sort((a, b) => b.size - a.size)
      case 'size-asc':
        return filesCopy.sort((a, b) => a.size - b.size)
      default:
        return filesCopy
    }
  }

  const handleRenameStart = (fileId: string, currentName: string) => {
    setEditingFileId(fileId)
    setEditingFileName(currentName)
  }

  const handleRenameSave = () => {
    if (!editingFileName.trim()) {
      setEditingFileId(null)
      setEditingFileName('')
      return
    }

    const isDuplicate = files.some(f => 
      f.id !== editingFileId && f.name === editingFileName.trim()
    )

    if (isDuplicate) {
      setError('A file with this name already exists')
      setTimeout(() => setError(''), 3000)
      return
    }

    setFiles(prev => prev.map(f => 
      f.id === editingFileId 
        ? { ...f, name: editingFileName.trim() }
        : f
    ))

    setEditingFileId(null)
    setEditingFileName('')
  }

  const handleRenameCancel = () => {
    setEditingFileId(null)
    setEditingFileName('')
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleRenameSave()
    } else if (e.key === 'Escape') {
      handleRenameCancel()
    }
  }

  // Unified function to process message content regardless of format
  const processMessageContent = (content: any, context: 'user' | 'assistant' = 'assistant'): string => {
    let markdown = ''
    
    // First, try to decode the content if it's a JSON-escaped string
    const decodedContent = decodeJsonString(content)
    
    if (Array.isArray(decodedContent)) {
      // Handle array content
      decodedContent.forEach((item: any) => {
        if (item?.type === 'text' && typeof item.text === 'string') {
          // Decode and format the text content
          const decodedText = decodeJsonString(item.text) as string
          markdown += formatMarkdownContent(decodedText) + '\n\n'
        } else if (item?.type === 'tool_use') {
          markdown += `### 🛠 Tool Use: ${item.name ?? '(unknown)'}\n`
          if (item.id) markdown += `*Tool ID: ${item.id}*\n\n`
          if (item.input !== undefined) {
            // Use the new formatToolInput function for better formatting
            const formattedInput = formatToolInput(item.input, item.name)
            markdown += formattedInput + '\n\n'
          }
        } else if (item?.tool_use_id && context === 'user') {
          // Handle tool results in user messages
          markdown += `#### 📊 Tool Result (${item.tool_use_id})\n\n`
          if (item.content?.[0]?.text) {
            const decodedResult = decodeJsonString(item.content[0].text) as string
            // Check if result looks like structured output or plain text
            if (decodedResult.includes('\n') || decodedResult.length > 100) {
              markdown += '```\n' + decodedResult + '\n```\n\n'
            } else {
              markdown += decodedResult + '\n\n'
            }
          }
        } else if (typeof item === 'string') {
          const decodedItem = decodeJsonString(item) as string
          markdown += formatMarkdownContent(decodedItem) + '\n\n'
        } else if (item && typeof item === 'object') {
          // Log unknown content types for debugging
          if (item.type && !['text', 'tool_use'].includes(item.type)) {
            console.warn(`Unknown content type '${item.type}' encountered in ${context} message:`, item)
          }
          markdown += '```json\n' + JSON.stringify(item, null, 2) + '\n```\n\n'
        }
      })
    } else if (typeof decodedContent === 'string') {
      markdown += formatMarkdownContent(decodedContent) + '\n\n'
    } else if (decodedContent && typeof decodedContent === 'object') {
      console.warn(`Object content encountered in ${context} message:`, decodedContent)
      markdown += '```json\n' + JSON.stringify(decodedContent, null, 2) + '\n```\n\n'
    }
    
    return markdown
  }

  const convertJsonlToMarkdown = (jsonlContent: string) => {
    try {
      const lines = jsonlContent.trim().split('\n')
      const messages: Message[] = []
      
      lines.forEach((line, index) => {
        try {
          const data = JSON.parse(line) as Message
          messages.push(data)
        } catch (e) {
          console.warn(`Skipping invalid JSON at line ${index + 1}:`, e)
        }
      })

      let markdown = '# Chat Conversation Log\n\n'
      
      const firstMessage = messages[0]
      if (firstMessage?.sessionId) {
        markdown += `**Session ID:** ${firstMessage.sessionId}\n`
        markdown += `**Branch:** ${firstMessage.gitBranch || 'N/A'}\n`
        markdown += `**Working Directory:** ${firstMessage.cwd || 'N/A'}\n\n`
        markdown += '---\n\n'
      }

      messages.forEach((msg) => {
        const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''
        
        if (msg.type === 'summary') {
          markdown += `## ${msg.summary}\n\n`
          return
        }

        if (msg.type === 'user') {
          let isModelCommand = false
          
          if (typeof msg.message?.content === 'string' && msg.message.content.includes('<command-name>')) {
            const commandMatch = msg.message.content.match(/<command-name>(.*?)<\/command-name>/)
            if (commandMatch && commandMatch[1] === '/model') {
              isModelCommand = true
            }
          }
          
          if (isModelCommand && typeof msg.message?.content === 'string' && msg.message.content.includes('<local-command-stdout>')) {
            const stdoutMatch = msg.message.content.match(/<local-command-stdout>(.*?)<\/local-command-stdout>/s)
            if (stdoutMatch?.[1] && stdoutMatch[1] !== '(no content)') {
              let outputText = stdoutMatch[1]
              const cleanText = outputText.replace(/\[[\d;]+m/g, '')
              
              if (cleanText.includes('Set model to')) {
                const modifiedText = cleanText.replace(/Set model to (.+)/, 'Set model to $1 per user request')
                markdown += `### 🔄 Model Changed\n\n`
                markdown += `_${modifiedText}_\n\n`
              }
            }
          } else {
            markdown += `### 👤 User`
            if (timestamp) markdown += ` - ${timestamp}`
            markdown += '\n\n'

            if (typeof msg.message?.content === 'string' && msg.message.content.includes('<command-name>')) {
              const commandMatch = msg.message.content.match(/<command-name>(.*?)<\/command-name>/)
              const commandMessage = msg.message.content.match(/<command-message>(.*?)<\/command-message>/)
              
              if (commandMatch && commandMatch[1] !== '/model') {
                markdown += `**Command:** \`${commandMatch[1]}\`\n\n`
                if (commandMessage?.[1]) {
                  markdown += `${commandMessage[1]}\n\n`
                }
              }
            } else if (msg.message?.content) {
              // Check if content contains a command with heredoc
              if (typeof msg.message.content === 'string' && msg.message.content.includes('$(cat <<')) {
                const { command, heredocContent } = extractHeredocContent(msg.message.content)
                if (heredocContent) {
                  markdown += `**Command:** \`${command.substring(0, 100)}${command.length > 100 ? '...' : ''}\`\n\n`
                  markdown += `**Content:**\n\n${heredocContent}\n\n`
                } else {
                  markdown += processMessageContent(msg.message.content, 'user')
                }
              } else {
                // Use unified processing for all user content
                markdown += processMessageContent(msg.message.content, 'user')
              }
            }
            
            if (!isModelCommand && typeof msg.message?.content === 'string' && msg.message.content.includes('<local-command-stdout>')) {
              const stdoutMatch = msg.message.content.match(/<local-command-stdout>(.*?)<\/local-command-stdout>/s)
              if (stdoutMatch?.[1] && stdoutMatch[1] !== '(no content)') {
                const decodedOutput = decodeJsonString(stdoutMatch[1]) as string
                markdown += `**Output:**\n\`\`\`\n${decodedOutput}\n\`\`\`\n\n`
              }
            }
          }
        }

        if (msg.type === 'assistant' && msg.message) {
          markdown += `### 🤖 Assistant`
          if (timestamp) markdown += ` - ${timestamp}`
          markdown += '\n\n'

          // Use unified processing for all assistant content
          if (msg.message.content) {
            markdown += processMessageContent(msg.message.content, 'assistant')
          }
        }

        markdown += '---\n\n'
      })

      return markdown
    } catch (e: any) {
      throw new Error('Error parsing JSONL: ' + e.message)
    }
  }

  const loadFilesFromFolderHandle = async (handle: FileSystemDirectoryHandle) => {
    setFiles([])
    setSelectedFileId(null)
    const newFiles: FileData[] = []

    for await (const [name, entry] of (handle as any).entries()) {
      if (entry.kind === 'file' && (name.endsWith('.jsonl') || name.endsWith('.json'))) {
        const file = await (entry as FileSystemFileHandle).getFile()
        const content = await file.text()
        let markdown: string | null = null
        let converted = false
        try {
          markdown = convertJsonlToMarkdown(content)
          converted = true
        } catch {
          // conversion failed; will show raw content
        }
        newFiles.push({
          id: generateFileId(),
          name,
          content,
          markdown,
          lastModified: file.lastModified,
          size: file.size,
          converted
        })
      }
    }

    setFiles(newFiles)
    if (newFiles.length > 0) setSelectedFileId(newFiles[0].id)
  }

  const handleAddFolder = async () => {
    if (!('showDirectoryPicker' in window)) {
      setError('Your browser does not support folder selection')
      return
    }
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'read' })
      const id = generateFileId()
      const entry: FolderEntry = { id, name: handle.name, addedAt: Date.now() }
      await saveFolderHandle(id, handle)
      const newFolders = [...folders, entry]
      setFolders(newFolders)
      localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(newFolders))
      setSelectedFolderId(id)
      await loadFilesFromFolderHandle(handle)
    } catch (e: any) {
      if (e.name !== 'AbortError') setError('Failed to open folder: ' + e.message)
    }
  }

  const handleSelectFolder = async (id: string) => {
    setSelectedFolderId(id)
    try {
      const handle = await getFolderHandle(id)
      if (!handle) {
        setError('Folder handle not found. Please re-add the folder.')
        return
      }
      const perm = await (handle as any).queryPermission({ mode: 'read' })
      if (perm !== 'granted') {
        const newPerm = await (handle as any).requestPermission({ mode: 'read' })
        if (newPerm !== 'granted') {
          setError('Permission denied for this folder')
          return
        }
      }
      await loadFilesFromFolderHandle(handle)
    } catch (e: any) {
      setError('Failed to load folder: ' + e.message)
    }
  }

  const handleRemoveFolder = async (id: string) => {
    await removeFolderHandle(id)
    const newFolders = folders.filter(f => f.id !== id)
    setFolders(newFolders)
    localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(newFolders))
    if (selectedFolderId === id) {
      setSelectedFolderId(null)
      setFiles([])
      setSelectedFileId(null)
    }
  }

  const handleFileSelect = (fileId: string) => {
    setSelectedFileId(fileId)
    const file = files.find(f => f.id === fileId)
    if (file && !file.converted) {
      try {
        const markdown = convertJsonlToMarkdown(file.content)
        setFiles(prev => prev.map(f => f.id === fileId ? { ...f, markdown, converted: true } : f))
      } catch (e: any) {
        setError(e.message)
      }
    }
    if (isMobile) {
      setSidebarOpen(false)
    }
  }

  const handleFilesUpload = (uploadedFiles: FileList) => {
    const newFiles: FileData[] = []
    
    Array.from(uploadedFiles).forEach(file => {
      if (file.name.endsWith('.jsonl') || file.name.endsWith('.json')) {
        const reader = new FileReader()
        reader.onload = (event) => {
          const content = event.target?.result as string
          let markdown: string | null = null
          let converted = false
          try {
            markdown = convertJsonlToMarkdown(content)
            converted = true
          } catch (e) {
            // conversion failed; user can retry manually
          }
          const fileObj: FileData = {
            id: generateFileId(),
            name: file.name,
            content,
            markdown,
            lastModified: file.lastModified,
            size: file.size,
            converted
          }

          setFiles(prev => [...prev, fileObj])
          
          if (!selectedFileId && newFiles.length === 0) {
            setSelectedFileId(fileObj.id)
          }
          newFiles.push(fileObj)
        }
        reader.readAsText(file)
      }
    })
    
    setError('')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0) {
      handleFilesUpload(droppedFiles)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const deleteFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
    if (selectedFileId === fileId) {
      const remaining = files.filter(f => f.id !== fileId)
      setSelectedFileId(remaining.length > 0 ? remaining[0].id : null)
    }
  }

  const clearAllFiles = () => {
    setFiles([])
    setSelectedFileId(null)
    setSearchResults({})
  }

  const exportAllMarkdown = () => {
    let combinedMarkdown = '# Combined JSONL Exports\n\n'
    
    files.forEach(file => {
      if (file.markdown) {
        combinedMarkdown += `## File: ${file.name}\n\n`
        combinedMarkdown += file.markdown
        combinedMarkdown += '\n\n---\n\n'
      }
    })

    const blob = new Blob([combinedMarkdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `combined-export-${new Date().toISOString().slice(0, 10)}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = async () => {
    const currentFile = files.find(f => f.id === selectedFileId)
    if (currentFile?.markdown) {
      try {
        await navigator.clipboard.writeText(currentFile.markdown)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (e) {
        console.error('Failed to copy:', e)
      }
    }
  }

  const currentFile = files.find(f => f.id === selectedFileId)

  const sortOptions = [
    { value: 'date-desc', label: 'Date (Newest)', icon: Calendar },
    { value: 'date-asc', label: 'Date (Oldest)', icon: Calendar },
    { value: 'name-asc', label: 'Name (A-Z)', icon: Type },
    { value: 'name-desc', label: 'Name (Z-A)', icon: Type },
    { value: 'size-desc', label: 'Size (Largest)', icon: HardDrive },
    { value: 'size-asc', label: 'Size (Smallest)', icon: HardDrive }
  ]

  return (
    <div className="h-screen bg-everforest-bg0 flex overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jsonl,.json"
        onChange={(e) => e.target.files && handleFilesUpload(e.target.files)}
        className="hidden"
      />
      {/* Sidebar */}
      <div className={cn(
        "w-full sm:w-[280px] sm:min-w-[280px] bg-everforest-bg-dim",
        "border-r border-everforest-bg4 flex flex-col",
        "absolute sm:relative h-screen transition-all duration-300 z-50 sm:z-0",
        sidebarOpen ? "left-0" : "-left-full sm:-left-[280px]"
      )}>
        {/* Folders Section */}
        <div className="p-4 border-b border-everforest-bg4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-everforest-aqua" />
              <h3 className="text-sm font-medium text-everforest-fg">Folders</h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleAddFolder}
                title="Add folder"
                className="p-1 hover:bg-everforest-bg2 rounded transition-colors"
              >
                <FolderPlus className="w-4 h-4 text-everforest-aqua" />
              </button>
              {isMobile && (
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 hover:bg-everforest-bg1 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-everforest-grey1" />
                </button>
              )}
            </div>
          </div>

          {folders.length === 0 ? (
            <p className="text-xs text-everforest-grey1 py-1">
              No folders added yet — click <FolderPlus className="inline w-3 h-3" /> to add one
            </p>
          ) : (
            <div className="space-y-0.5 max-h-36 overflow-y-auto custom-scrollbar">
              {folders.map(folder => (
                <div
                  key={folder.id}
                  onClick={() => handleSelectFolder(folder.id)}
                  className={cn(
                    "flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors group",
                    selectedFolderId === folder.id
                      ? "bg-everforest-bg2 text-everforest-aqua"
                      : "text-everforest-fg hover:bg-everforest-bg1"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderOpen className={cn(
                      "w-3.5 h-3.5 flex-shrink-0",
                      selectedFolderId === folder.id ? "text-everforest-aqua" : "text-everforest-grey1"
                    )} />
                    <span className="text-xs truncate">{folder.name}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveFolder(folder.id) }}
                    className="p-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-everforest-red rounded transition-all"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Files Section */}
        <div className="p-4 border-b border-everforest-bg4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-everforest-fg">
              Files ({files.length})
            </h3>
          </div>

          {/* Search Bar */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-everforest-grey1" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-everforest-bg0 border border-everforest-bg4 rounded-md text-everforest-fg text-sm outline-none focus:border-everforest-green transition-colors"
            />
          </div>

          {/* Sort Dropdown */}
          {files.length > 1 && (
            <div className="relative mb-3">
              <button
                onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                className="w-full px-3 py-2 bg-everforest-bg2 text-everforest-fg border border-everforest-bg4 rounded-md text-xs flex items-center justify-between hover:bg-everforest-bg3 transition-colors"
              >
                <div className="flex items-center gap-1">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  {sortOptions.find(opt => opt.value === sortOrder)?.label || 'Sort'}
                </div>
                {sortDropdownOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              
              {sortDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-everforest-bg1 border border-everforest-bg4 rounded-md shadow-lg z-10">
                  {sortOptions.map(option => {
                    const Icon = option.icon
                    return (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSortOrder(option.value)
                          setSortDropdownOpen(false)
                        }}
                        className={cn(
                          "w-full px-3 py-2 text-xs flex items-center gap-2 text-left transition-colors",
                          sortOrder === option.value
                            ? "bg-everforest-bg2 text-everforest-green"
                            : "text-everforest-fg hover:bg-everforest-bg2"
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 px-3 py-2 bg-everforest-bg2 text-everforest-blue border border-everforest-bg4 rounded-md text-xs flex items-center justify-center gap-1 hover:bg-everforest-bg3 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Add Files
            </button>
          </div>

          {files.some(f => f.converted) && (
            <button
              onClick={exportAllMarkdown}
              className="w-full px-3 py-2 bg-everforest-bg-blue text-everforest-blue border border-everforest-blue/30 rounded-md text-xs flex items-center justify-center gap-1 mb-2 hover:bg-everforest-bg-blue/80 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export All Markdown
            </button>
          )}

          {files.length > 0 && (
            <button
              onClick={clearAllFiles}
              className="w-full px-3 py-2 bg-everforest-bg-red text-everforest-red border border-everforest-red/30 rounded-md text-xs flex items-center justify-center gap-1 hover:bg-everforest-bg-red/80 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All
            </button>
          )}
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {files.length === 0 ? (
            <div className="p-4 text-center text-everforest-grey1 text-sm">
              No files uploaded yet.
              <br />
              Drag & drop JSONL files here or click &ldquo;Add Files&rdquo;
            </div>
          ) : (
            getSortedFiles().map(file => {
              const isSelected = file.id === selectedFileId
              const hasSearchMatch = searchResults[file.id]
              const isEditing = editingFileId === file.id
              
              return (
                <div
                  key={file.id}
                  onClick={() => !isEditing && handleFileSelect(file.id)}
                  className={cn(
                    "p-3 mb-1 rounded-md cursor-pointer transition-all",
                    isSelected
                      ? "bg-everforest-bg2 border border-everforest-green"
                      : hasSearchMatch
                      ? "bg-everforest-bg1 border border-transparent hover:bg-everforest-bg2"
                      : "border border-transparent hover:bg-everforest-bg1"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <File className={cn(
                        "w-4 h-4 flex-shrink-0",
                        file.converted ? "text-everforest-green" : "text-everforest-yellow"
                      )} />
                      {isEditing ? (
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editingFileName}
                          onChange={(e) => setEditingFileName(e.target.value)}
                          onBlur={handleRenameSave}
                          onKeyDown={handleRenameKeyDown}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 px-2 py-1 bg-everforest-bg0 border border-everforest-green rounded text-everforest-fg text-sm outline-none"
                        />
                      ) : (
                        <span className="text-sm text-everforest-fg truncate flex-1">
                          {file.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRenameSave()
                            }}
                            className="p-1 text-everforest-green hover:bg-everforest-bg3 rounded"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRenameCancel()
                            }}
                            className="p-1 text-everforest-grey1 hover:bg-everforest-bg3 rounded"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRenameStart(file.id, file.name)
                            }}
                            className="p-1 text-everforest-grey1 opacity-60 hover:opacity-100 hover:bg-everforest-bg3 rounded transition-all"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteFile(file.id)
                            }}
                            className="p-1 text-everforest-grey1 opacity-60 hover:opacity-100 hover:bg-everforest-bg3 rounded transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-xs text-everforest-grey1 flex items-center gap-2 flex-wrap">
                    <span>{formatFileSize(file.size)}</span>
                    <span>•</span>
                    <span>{formatFileDate(file.lastModified)}</span>
                    {file.converted && (
                      <>
                        <span>•</span>
                        <span className="text-everforest-green">✓ Converted</span>
                      </>
                    )}
                    {file.error && (
                      <>
                        <span>•</span>
                        <span className="text-everforest-red">⚠ Error</span>
                      </>
                    )}
                  </div>

                  {hasSearchMatch && (
                    <div className="mt-2 text-xs text-everforest-blue">
                      {hasSearchMatch.matches} match{hasSearchMatch.matches !== 1 ? 'es' : ''}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-everforest-bg4 bg-everforest-bg1 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {(!sidebarOpen || isMobile) && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1 hover:bg-everforest-bg2 rounded transition-colors"
              >
                <Menu className="w-5 h-5 text-everforest-fg" />
              </button>
            )}
            <FileText className="w-6 h-6 text-everforest-green" />
            <h1 className="text-lg sm:text-xl font-medium text-everforest-fg">
              JSONL to Markdown Converter
            </h1>
          </div>
          
          {currentFile && currentFile.markdown && (
            <button
              onClick={copyToClipboard}
              className="px-3 py-2 bg-everforest-bg2 text-everforest-blue border border-everforest-bg4 rounded-md text-sm flex items-center gap-2 hover:bg-everforest-bg3 transition-colors"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
          )}
        </div>

        {/* Content Area */}
        <div 
          className="flex-1 p-4 sm:p-6 overflow-hidden flex flex-col"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {isDragging && (
            <div className="fixed inset-0 bg-everforest-bg-blue/95 flex items-center justify-center z-[9999]">
              <div className="p-8 bg-everforest-bg1 rounded-lg border-2 border-dashed border-everforest-blue text-center">
                <Upload className="w-12 h-12 text-everforest-blue mx-auto mb-4" />
                <p className="text-everforest-fg text-lg">
                  Drop your JSONL files here
                </p>
              </div>
            </div>
          )}

          {!currentFile ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-everforest-grey1">
              <FolderOpen className="w-16 h-16 text-everforest-grey0 mb-4" />
              <h2 className="text-2xl text-everforest-fg mb-2">
                No File Selected
              </h2>
              <p className="mb-8 text-base">
                Select a file from the sidebar or drag & drop JSONL files here
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-everforest-green text-everforest-bg0 rounded-lg text-base font-medium flex items-center gap-2 hover:bg-everforest-green/90 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Choose Files
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 h-full overflow-hidden">
              {/* JSONL Source - collapsible */}
              <div className="flex-shrink-0">
                <button
                  onClick={() => setJsonlExpanded(prev => !prev)}
                  className="flex items-center gap-2 text-sm text-everforest-grey1 hover:text-everforest-fg transition-colors"
                >
                  {jsonlExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  JSONL Source
                </button>

                {jsonlExpanded && (
                  <div className="mt-2 flex flex-col gap-2">
                    <textarea
                      value={currentFile.content}
                      onChange={(e) => {
                        const newContent = e.target.value
                        setFiles(prev => prev.map(f =>
                          f.id === currentFile.id
                            ? { ...f, content: newContent, converted: false }
                            : f
                        ))
                      }}
                      className="w-full h-48 p-4 bg-everforest-bg2 border border-everforest-bg4 rounded-lg font-mono text-sm text-everforest-fg outline-none resize-none custom-scrollbar focus:border-everforest-green transition-colors"
                    />
                    {error && (
                      <div className="p-3 bg-everforest-bg-red border border-everforest-red/30 rounded-md text-everforest-red text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Markdown Output - primary */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="w-full flex-1 min-h-[200px] p-4 bg-everforest-bg2 border border-everforest-bg4 rounded-lg overflow-auto custom-scrollbar">
                  {currentFile.markdown ? (
                    <pre className="whitespace-pre-wrap break-words font-mono text-sm text-everforest-fg">
                      {currentFile.markdown}
                    </pre>
                  ) : (
                    <p className="text-everforest-grey1 text-sm">
                      Converted markdown will appear here...
                    </p>
                  )}
                </div>

                {currentFile.markdown && (
                  <button
                    onClick={() => {
                      const blob = new Blob([currentFile.markdown!], { type: 'text/markdown' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${currentFile.name.replace(/\.[^/.]+$/, '')}-converted.md`
                      document.body.appendChild(a)
                      a.click()
                      document.body.removeChild(a)
                      URL.revokeObjectURL(url)
                    }}
                    className="mt-4 w-full py-3 bg-everforest-blue text-everforest-bg0 rounded-lg text-base font-medium flex items-center justify-center gap-2 hover:bg-everforest-blue/90 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Markdown
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}