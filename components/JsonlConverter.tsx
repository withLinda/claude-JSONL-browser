'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  FileText, Copy, CheckCircle, Upload, Download, X, 
  Search, ChevronRight, ChevronDown, Menu, File,
  FolderOpen, Trash2, FileCheck, AlertCircle, Edit2,
  ArrowUpDown, Calendar, Type, HardDrive, Check
} from 'lucide-react'
import { cn, formatFileSize, formatFileDate, generateFileId } from '@/lib/utils'

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
  const [convertAllProgress, setConvertAllProgress] = useState<number | null>(null)
  
  const [sortOrder, setSortOrder] = useState<string>('date-desc')
  const [editingFileId, setEditingFileId] = useState<string | null>(null)
  const [editingFileName, setEditingFileName] = useState('')
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false)
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

  const convertJsonlToMarkdown = (jsonlContent: string) => {
    try {
      const lines = jsonlContent.trim().split('\n')
      const messages: any[] = []
      
      lines.forEach((line, index) => {
        try {
          const data = JSON.parse(line)
          messages.push(data)
        } catch (e) {
          console.warn(`Skipping invalid JSON at line ${index + 1}`)
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
          
          if (msg.message?.content?.includes('<command-name>')) {
            const commandMatch = msg.message.content.match(/<command-name>(.*?)<\/command-name>/)
            if (commandMatch && commandMatch[1] === '/model') {
              isModelCommand = true
            }
          }
          
          if (isModelCommand && msg.message?.content?.includes('<local-command-stdout>')) {
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

            if (msg.message?.content?.includes('<command-name>')) {
              const commandMatch = msg.message.content.match(/<command-name>(.*?)<\/command-name>/)
              const commandMessage = msg.message.content.match(/<command-message>(.*?)<\/command-message>/)
              
              if (commandMatch && commandMatch[1] !== '/model') {
                markdown += `**Command:** \`${commandMatch[1]}\`\n\n`
                if (commandMessage?.[1]) {
                  markdown += `${commandMessage[1]}\n\n`
                }
              }
            } else if (msg.message?.content?.[0]?.tool_use_id) {
              const toolResult = msg.message.content[0]
              markdown += `**Tool Result** (${toolResult.tool_use_id})\n\n`
              if (toolResult.content?.[0]?.text) {
                markdown += '```\n' + toolResult.content[0].text + '\n```\n\n'
              }
            } else if (msg.message?.content) {
              markdown += `${msg.message.content}\n\n`
            }
            
            if (!isModelCommand && msg.message?.content?.includes('<local-command-stdout>')) {
              const stdoutMatch = msg.message.content.match(/<local-command-stdout>(.*?)<\/local-command-stdout>/s)
              if (stdoutMatch?.[1] && stdoutMatch[1] !== '(no content)') {
                markdown += `**Output:**\n\`\`\`\n${stdoutMatch[1]}\n\`\`\`\n\n`
              }
            }
          }
        }

        if (msg.type === 'assistant' && msg.message) {
          markdown += `### 🤖 Assistant`
          if (timestamp) markdown += ` - ${timestamp}`
          markdown += '\n\n'

          if (msg.message.content) {
            msg.message.content.forEach((content: any) => {
              if (content.type === 'text') {
                markdown += `${content.text}\n\n`
              } else if (content.type === 'tool_use') {
                markdown += `**Tool Use:** ${content.name}\n`
                markdown += `*Tool ID: ${content.id}*\n\n`
                if (content.input) {
                  markdown += '```json\n' + JSON.stringify(content.input, null, 2) + '\n```\n\n'
                }
              }
            })
          }
        }

        markdown += '---\n\n'
      })

      return markdown
    } catch (e: any) {
      throw new Error('Error parsing JSONL: ' + e.message)
    }
  }

  const handleFileSelect = (fileId: string) => {
    setSelectedFileId(fileId)
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
          const fileObj: FileData = {
            id: generateFileId(),
            name: file.name,
            content: event.target?.result as string,
            markdown: null,
            lastModified: file.lastModified,
            size: file.size,
            converted: false
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

  const convertCurrentFile = () => {
    const currentFile = files.find(f => f.id === selectedFileId)
    if (!currentFile) {
      setError('No file selected')
      return
    }

    try {
      const markdown = convertJsonlToMarkdown(currentFile.content)
      setFiles(prev => prev.map(f => 
        f.id === selectedFileId 
          ? { ...f, markdown, converted: true }
          : f
      ))
      setError('')
    } catch (e: any) {
      setError(e.message)
    }
  }

  const convertAllFiles = async () => {
    setConvertAllProgress(0)
    const totalFiles = files.length
    let converted = 0

    const updatedFiles: FileData[] = []
    
    for (const file of files) {
      try {
        const markdown = convertJsonlToMarkdown(file.content)
        updatedFiles.push({ ...file, markdown, converted: true })
      } catch (e: any) {
        updatedFiles.push({ ...file, error: e.message })
      }
      converted++
      setConvertAllProgress(Math.round((converted / totalFiles) * 100))
    }
    
    setFiles(updatedFiles)
    setTimeout(() => setConvertAllProgress(null), 1000)
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
      {/* Sidebar */}
      <div className={cn(
        "w-full sm:w-[280px] sm:min-w-[280px] bg-everforest-bg-dim",
        "border-r border-everforest-bg4 flex flex-col",
        "absolute sm:relative h-screen transition-all duration-300 z-50 sm:z-0",
        sidebarOpen ? "left-0" : "-left-full sm:-left-[280px]"
      )}>
        <div className="p-4 border-b border-everforest-bg4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-everforest-green" />
              <h3 className="text-base font-medium text-everforest-fg">
                Files ({files.length})
              </h3>
            </div>
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 hover:bg-everforest-bg1 rounded transition-colors"
              >
                <X className="w-5 h-5 text-everforest-grey1" />
              </button>
            )}
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
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jsonl,.json"
              onChange={(e) => e.target.files && handleFilesUpload(e.target.files)}
              className="hidden"
            />
            {files.length > 1 && (
              <button
                onClick={convertAllFiles}
                className="flex-1 px-3 py-2 bg-everforest-bg-green text-everforest-green border border-everforest-green/30 rounded-md text-xs flex items-center justify-center gap-1 hover:bg-everforest-bg-green/80 transition-colors"
              >
                {convertAllProgress !== null ? (
                  `${convertAllProgress}%`
                ) : (
                  <>
                    <FileCheck className="w-3.5 h-3.5" />
                    Convert All
                  </>
                )}
              </button>
            )}
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
            <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden">
              {/* Input Section */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base text-everforest-fg">
                    JSONL Content - {currentFile.name}
                  </h3>
                </div>
                
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
                  className="w-full flex-1 min-h-[200px] p-4 bg-everforest-bg2 border border-everforest-bg4 rounded-lg font-mono text-sm text-everforest-fg outline-none resize-none custom-scrollbar focus:border-everforest-green transition-colors"
                />

                <button
                  onClick={convertCurrentFile}
                  className="mt-4 w-full py-3 bg-everforest-green text-everforest-bg0 rounded-lg text-base font-medium hover:bg-everforest-green/90 transition-colors"
                >
                  Convert to Markdown
                </button>

                {error && (
                  <div className="mt-4 p-3 bg-everforest-bg-red border border-everforest-red/30 rounded-md text-everforest-red text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}
              </div>

              {/* Output Section */}
              <div className="flex-1 flex flex-col min-h-0">
                <h3 className="text-base text-everforest-fg mb-4">
                  Markdown Output
                </h3>
                
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