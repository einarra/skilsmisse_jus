'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Bot, Loader2, Sparkles, Search, BookOpen, ExternalLink, Globe, MessageSquare } from 'lucide-react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type Message = {
    role: 'user' | 'assistant';
    content: string;
};

type SearchResult = {
    title: string;
    link: string;
    snippet: string;
};

// Helper to remove OpenAI citation markers like 【4:0†source】
function cleanText(text: string) {
    return text.replace(/【\d+:\d+†source】/g, '');
}

export default function ChatInterface() {
    // Navigation state
    const [activeTab, setActiveTab] = useState<'chat' | 'search'>('chat');

    // Chat state
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [threadId, setThreadId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (activeTab === 'chat') {
            scrollToBottom();
        }
    }, [messages, activeTab]);

    // Height adjustment for textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
        }
    }, [input]);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        // Reset height
        if (inputRef.current) inputRef.current.style.height = 'auto';

        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage, threadId }),
            });

            if (!response.ok) throw new Error('Failed to send message');

            const newThreadId = response.headers.get('x-thread-id');
            if (newThreadId) setThreadId(newThreadId);

            const reader = response.body?.getReader();
            if (!reader) return;

            const decoder = new TextDecoder();
            let assistantMessage = '';

            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                assistantMessage += chunk;

                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = {
                        role: 'assistant',
                        content: assistantMessage
                    };
                    return newMessages;
                });
            }
        } catch (error) {
            console.error('Error:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Beklager, det oppstod en feil. Vennligst prøv igjen.'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim() || isSearching) return;

        setIsSearching(true);
        setSearchResults([]);

        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: searchQuery }),
            });

            if (!response.ok) throw new Error('Search failed');

            const data = await response.json();
            setSearchResults(data.results || []);
        } catch (error) {
            console.error('Search Error:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="flex flex-col h-[100dvh] bg-slate-50 overflow-hidden">
            {/* Header with Navigation */}
            <header className="flex-none h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-10 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="bg-slate-900 text-white p-1.5 rounded-lg">
                        <Bot size={18} />
                    </div>
                    <h1 className="text-sm font-semibold text-slate-900 tracking-tight hidden sm:block">Skilsmisse Jus Agent</h1>
                </div>

                {/* Tab Navigation */}
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('chat')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                            activeTab === 'chat'
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <MessageSquare size={16} />
                        AI Assistent
                    </button>
                    <button
                        onClick={() => setActiveTab('search')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                            activeTab === 'search'
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <Globe size={16} />
                        Kildesøk
                    </button>
                </div>

                <div className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider rounded-full hidden sm:block">
                    Beta
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 min-h-0 relative">
                {/* Chat View */}
                {activeTab === 'chat' && (
                    <div className="absolute inset-0 flex flex-col">
                        <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
                            {messages.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                                    <div className="bg-white p-4 rounded-2xl shadow-sm mb-4">
                                        <Sparkles className="w-8 h-8 text-blue-600" />
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-900 mb-2">Hei, hva lurer du på?</h2>
                                    <p className="text-slate-500 max-w-xs text-sm leading-relaxed">
                                        Jeg kan hjelpe deg med spørsmål om ekteskapsloven, gjeld og deling av bo.
                                    </p>
                                </div>
                            )}

                            {messages.map((msg, index) => (
                                <div
                                    key={index}
                                    className={cn(
                                        "flex flex-col max-w-[85%] sm:max-w-[75%]",
                                        msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                                    )}
                                >
                                    <div className={cn(
                                        "rounded-2xl px-5 py-3 shadow-sm text-sm sm:text-base leading-relaxed whitespace-pre-wrap",
                                        msg.role === 'user'
                                            ? "bg-blue-600 text-white rounded-tr-sm"
                                            : "bg-white text-slate-800 border border-slate-200 rounded-tl-sm"
                                    )}>
                                        {msg.role === 'assistant' ? (
                                            <div className="prose prose-slate prose-sm max-w-none dark:prose-invert">
                                                <ReactMarkdown
                                                    components={{
                                                        a: ({ node, ...props }) => (
                                                            <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" />
                                                        )
                                                    }}
                                                >
                                                    {cleanText(msg.content)}
                                                </ReactMarkdown>
                                            </div>
                                        ) : (
                                            msg.content
                                        )}
                                    </div>
                                </div>
                            ))}

                            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                                <div className="flex mr-auto items-start max-w-[75%]">
                                    <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 border border-slate-200 shadow-sm flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                        <span className="text-sm text-slate-500">Tenker...</span>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} className="h-4" />
                        </div>

                        {/* Input Area */}
                        <div className="flex-none bg-white border-t border-slate-200 p-3 sm:p-4 pb-safe">
                            <div className="w-full relative flex items-end gap-2 bg-slate-100 p-2 rounded-3xl border border-transparent focus-within:border-blue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50 transition-all">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Still et juridisk spørsmål..."
                                    rows={1}
                                    className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-2.5 px-3 max-h-32 text-slate-900 placeholder:text-slate-400 text-base"
                                />
                                <button
                                    onClick={() => handleSubmit()}
                                    disabled={isLoading || !input.trim()}
                                    className="flex-none p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-0.5"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Search View */}
                {activeTab === 'search' && (
                    <div className="absolute inset-0 flex flex-col bg-slate-50 overflow-hidden">
                        <div className="flex-1 overflow-y-auto">
                            <div className="p-4 sm:p-8 w-full">
                                <div className="text-center mb-8">
                                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Søk i rettskilder</h2>
                                    <p className="text-slate-500">Søk direkte i lovdata.no og jusinfo.no</p>
                                </div>

                                <div className="bg-white p-2 rounded-full shadow-sm border border-slate-200 flex gap-2 w-full mb-8">
                                    <div className="pl-3 flex items-center pointer-events-none text-slate-400">
                                        <Search size={20} />
                                    </div>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Søk etter lover, regler eller emner..."
                                        className="flex-1 border-none focus:ring-0 text-slate-900 placeholder:text-slate-400 h-10"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleSearch();
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={() => handleSearch()}
                                        disabled={isSearching || !searchQuery.trim()}
                                        className="bg-blue-600 text-white px-6 py-2 rounded-full hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
                                    >
                                        {isSearching ? <Loader2 size={18} className="animate-spin" /> : 'Søk'}
                                    </button>
                                </div>

                                <div className="space-y-4 w-full">
                                    {searchResults.length === 0 && !isSearching && searchQuery && (
                                        <div className="text-center text-slate-400 py-12">
                                            Ingen resultater funnet.
                                        </div>
                                    )}

                                    {searchResults.map((result, idx) => (
                                        <div key={idx} className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                                            <a
                                                href={result.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block"
                                            >
                                                <h3 className="text-blue-600 font-semibold text-lg mb-1 group-hover:underline flex items-center gap-2">
                                                    {result.title}
                                                    <ExternalLink size={14} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                                                </h3>
                                                <div className="text-xs text-slate-400 mb-2 truncate">{result.link}</div>
                                                <p className="text-slate-600 text-sm leading-relaxed">
                                                    {result.snippet}
                                                </p>
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
