import ChatInterface from '@/components/ChatInterface';

export default function Home() {
  return (
    <main className="h-full">
      {/* 
        ChatInterface now handles the full layout including header and input area 
        to ensure proper full-height behavior on mobile.
      */}
      <ChatInterface />
    </main>
  );
}
