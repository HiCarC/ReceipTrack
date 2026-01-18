import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Send, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const buildFallbackMessage = () =>
  "I couldn't summarize your spend yet. Try asking again.";

export default function ReceiptChatDrawer({ open, onOpenChange }) {
  const { auth } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: 'intro',
      role: 'assistant',
      text: 'Ask about your spending — try “How much did I spend on dining this year?”',
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
    return () => clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setInput('');
    const userMessage = { id: `user-${Date.now()}`, role: 'user', text };
    setMessages((prev) => [...prev, userMessage]);
    setIsSending(true);

    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        throw new Error('Please sign in to use chat.');
      }
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ question: text }),
      });
      const rawText = await response.text();
      let data = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = null;
      }
      if (!response.ok) {
        throw new Error(data?.error || rawText || 'Failed to fetch answer.');
      }
      const assistantText = data?.answer || buildFallbackMessage();
      setMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: 'assistant', text: assistantText },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          text: error?.message || "I couldn't reach the chat service. Try again in a moment.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-app-bg text-white border border-white/10 rounded-3xl p-0 max-w-md w-[95vw] max-h-[92vh] overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Receipt spend chat</DialogTitle>
          <DialogDescription>Chat with your receipt spend summary assistant.</DialogDescription>
        </DialogHeader>
        <div className="relative border-b border-white/10 bg-gradient-to-r from-black/60 via-black/30 to-black/60 px-5 pb-4 pt-6">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-app-primary/20 text-app-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-wider text-app-muted">Receipt Chat</p>
              <h2 className="text-lg font-bold">Spend Insights Assistant</h2>
            </div>
          </div>
        </div>

        <ScrollArea className="max-h-[62vh] px-5 py-4">
          <div className="flex flex-col gap-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-lg ${
                    message.role === 'user'
                      ? 'bg-app-primary text-white'
                      : 'bg-white/10 text-slate-100'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-white/10 bg-black/40 px-4 pb-5 pt-3">
          <div className="flex items-end gap-3">
            <textarea
              ref={inputRef}
              rows={2}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about your spend…"
              className="min-h-[44px] flex-1 resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-app-primary"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
            />
            <Button
              onClick={sendMessage}
              disabled={!canSend}
              className="h-11 w-11 rounded-2xl bg-app-primary text-white hover:bg-app-primary/90"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-app-muted">
            Answers are based on summarized receipt data only.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
