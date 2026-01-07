'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, Loader2, Sparkles, Search, ExternalLink, Globe, MessageSquare } from 'lucide-react';
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
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Auto-scroll chat messages when new messages arrive (only if near bottom)
    useEffect(() => {
        if (activeTab === 'chat' && messages.length > 0 && chatContainerRef.current) {
            const container = chatContainerRef.current;
            const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

            if (isNearBottom) {
                setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 50);
            }
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
        <div className="flex flex-col h-[100dvh] bg-[#041426] overflow-hidden">
            {/* Header */}
            <header className="flex-none bg-[#041426] border-b border-[#374151] px-4 z-20 shadow-sm relative" style={{ height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="flex items-center z-30">
                    <div className="rounded-lg overflow-hidden border border-[#374151]/30 shadow-soft bg-white transition-transform hover:scale-105" style={{ height: '36px', flexShrink: 0 }}>
                        <img src="/logo.jpg" alt="LovSvar Logo" className="h-full w-auto object-contain" />
                    </div>
                </div>

                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20">
                    <h1 className="text-xs sm:text-sm font-semibold text-[#F9FAFB] tracking-tight whitespace-nowrap px-3 py-1.5 sm:px-4 sm:py-2 bg-[#041426]/80 backdrop-blur-md rounded-full shadow-lg border border-[#374151]/50 pointer-events-auto">
                        LovSvar - Ekteskap og skilsmisse
                    </h1>
                </div>

                <div className="flex items-center gap-3 z-30">
                    <div className="flex bg-[#111827] p-1 rounded-xl border border-[#374151] shadow-inner" style={{ display: 'flex' }}>
                        <button
                            onClick={() => setActiveTab('chat')}
                            aria-label="Bytt til Assistent-fane"
                            className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all",
                                activeTab === 'chat'
                                    ? "bg-[#3B82F6] text-white shadow-soft"
                                    : "text-[#9CA3AF] hover:text-[#F9FAFB]"
                            )}
                        >
                            <MessageSquare size={12} />
                            <span className="hidden xs:inline">Assistent</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('search')}
                            aria-label="Bytt til Kildesøk-fane"
                            className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all",
                                activeTab === 'search'
                                    ? "bg-[#3B82F6] text-white shadow-soft"
                                    : "text-[#9CA3AF] hover:text-[#F9FAFB]"
                            )}
                        >
                            <Globe size={12} />
                            <span className="hidden xs:inline">Kildesøk</span>
                        </button>
                    </div>

                    <div className="hidden md:block px-2 py-0.5 bg-[#043326] text-[#16A34A] text-[10px] font-bold uppercase tracking-wider rounded-full border border-[#16A34A]/20">
                        Beta
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <AnimatePresence mode="wait">
                    {/* Chat View */}
                    {activeTab === 'chat' && (
                        <motion.div
                            key="chat"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex-1 flex flex-col min-h-0 overflow-hidden"
                        >
                            <div
                                ref={chatContainerRef}
                                className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth"
                                style={{ height: '100%' }}
                            >
                                <AnimatePresence initial={false}>
                                    {messages.length === 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex flex-col items-center justify-center h-full text-center px-6"
                                        >
                                            <div className="bg-[#F5EDE2] p-4 rounded-2xl shadow-soft mb-4">
                                                <Sparkles className="w-8 h-8 text-[#3B82F6]" />
                                            </div>
                                            <h2 className="text-xl font-bold text-[#F9FAFB] mb-2">Hei, hva lurer du på?</h2>
                                            <p className="text-[#9CA3AF] max-w-xs text-sm leading-relaxed">
                                                Jeg kan hjelpe deg med spørsmål om ekteskapsloven, gjeld og deling av bo.
                                            </p>
                                        </motion.div>
                                    )}

                                    {messages.map((msg, index) => (
                                        <motion.div
                                            key={index}
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            transition={{ duration: 0.2 }}
                                            className={cn(
                                                "flex flex-col max-w-[85%] sm:max-w-[75%]",
                                                msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                                            )}
                                        >
                                            <div className={cn(
                                                "rounded-2xl px-5 py-3 shadow-soft text-sm sm:text-base leading-relaxed whitespace-pre-wrap",
                                                msg.role === 'user'
                                                    ? "bg-[#FFFFFF] text-[#000000] rounded-tr-sm shadow-sm"
                                                    : "bg-[#F5EDE2] text-[#1F2933] rounded-tl-sm border border-[#E7E1D7]"
                                            )}>
                                                {msg.role === 'assistant' ? (
                                                    <div className="prose prose-slate prose-sm max-w-none">
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm]}
                                                            components={{
                                                                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                                                a: ({ node: _node, ...props }) => (
                                                                    <a {...props} target="_blank" rel="noopener noreferrer" className="text-[#3B82F6] font-medium hover:underline" />
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
                                        </motion.div>
                                    ))}

                                    {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="flex mr-auto items-start max-w-[75%]"
                                        >
                                            <div className="bg-[#F5EDE2] rounded-2xl rounded-tl-sm px-4 py-3 border border-[#E7E1D7] shadow-soft flex items-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin text-[#3B82F6]" />
                                                <span className="text-sm text-[#6B7280]">Tenker...</span>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div ref={messagesEndRef} className="h-4" />
                            </div>

                            {/* Input Area */}
                            <div className="flex-none bg-[#041426] border-t border-[#374151]" style={{ padding: '1.5rem 1rem 2.5rem 1rem' }}>
                                <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                                    <div className="relative flex items-end gap-3 bg-[#FFFFFF] p-3 rounded-2xl border border-gray-200 shadow-xl focus-within:border-[#3B82F6] focus-within:ring-4 focus-within:ring-[#3B82F6]/10 transition-all">
                                        <textarea
                                            ref={inputRef}
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="Still et juridisk spørsmål..."
                                            aria-label="Juridisk spørsmål inntasting"
                                            rows={1}
                                            className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-3 px-4 max-h-40 text-[#000000] placeholder:text-gray-400 text-base leading-relaxed"
                                        />
                                        <button
                                            onClick={() => handleSubmit()}
                                            disabled={isLoading || !input.trim()}
                                            aria-label="Send melding"
                                            className="flex-none p-3.5 bg-[#3B82F6] text-white rounded-xl hover:bg-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed shadow-soft transition-all mb-0.5"
                                        >
                                            <Send size={20} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Search View */}
                    {activeTab === 'search' && (
                        <motion.div
                            key="search"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex-1 flex flex-col min-h-0 overflow-hidden"
                        >
                            <div
                                ref={searchContainerRef}
                                className="flex-1 overflow-y-auto"
                                style={{ height: '100%', WebkitOverflowScrolling: 'touch' }}
                            >
                                <div className="p-4 sm:p-8 max-w-4xl mx-auto w-full">
                                    <div className="text-center mb-10">
                                        <h2 className="text-2xl font-bold text-[#F9FAFB] mb-2">Søk i rettskilder</h2>
                                        <p className="text-[#9CA3AF]">Søk direkte i jurdiske rettskilder</p>
                                    </div>

                                    <div className="bg-[#111827] p-2 rounded-xl shadow-soft border border-[#374151] flex gap-2 w-full mb-10 focus-within:border-[#3B82F6] transition-all">
                                        <div className="pl-3 flex items-center pointer-events-none text-[#9CA3AF]">
                                            <Search size={20} />
                                        </div>
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Bruk nøkkelord for å søke..."
                                            aria-label="Søk i rettskilder"
                                            className="flex-1 bg-transparent border-none focus:ring-0 text-[#F9FAFB] placeholder:text-[#9CA3AF] h-10"
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
                                            aria-label="Søk"
                                            className="bg-[#3B82F6] text-white px-6 py-2 rounded-lg hover:bg-[#2563EB] disabled:opacity-50 font-medium transition-all shadow-soft"
                                        >
                                            {isSearching ? <Loader2 size={18} className="animate-spin" /> : 'Søk'}
                                        </button>
                                    </div>

                                    {isSearching && (
                                        <div className="flex items-center justify-center py-12">
                                            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                                            <span className="ml-2 text-slate-500">Søker...</span>
                                        </div>
                                    )}

                                    {!isSearching && (
                                        <div className="space-y-4 w-full pb-8">
                                            {searchResults.length === 0 && searchQuery && (
                                                <div className="text-center text-slate-400 py-12">
                                                    Ingen resultater funnet.
                                                </div>
                                            )}

                                            <AnimatePresence>
                                                {searchResults.map((result, idx) => (
                                                    <motion.div
                                                        key={idx}
                                                        initial={{ opacity: 0, scale: 0.95 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        transition={{ delay: idx * 0.05 }}
                                                        className="bg-[#F5EDE2] p-5 rounded-xl border border-[#E7E1D7] shadow-soft hover:shadow-lg transition-all group"
                                                    >
                                                        <a
                                                            href={result.link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="block"
                                                        >
                                                            <h3 className="text-[#3B82F6] font-bold text-lg mb-1 group-hover:underline flex items-center gap-2">
                                                                {result.title}
                                                                <ExternalLink size={14} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                                                            </h3>
                                                            <div className="text-xs text-[#6B7280] mb-3 truncate">{result.link}</div>
                                                            <p className="text-[#1F2933] text-sm leading-relaxed">
                                                                {result.snippet}
                                                            </p>
                                                        </a>
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

        </div>
    );
}

