import React, { useState } from 'react';
import {
  MessageSquare,
  Send,
  Paperclip,
  CheckCheck,
  Building2,
  ShieldCheck,
  Bot,
  User,
  Search,
  Sparkles,
} from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';
import { BuyerNavHeader } from './BuyerNavHeader';

export const MessagesView: React.FC = () => {
  const { showToast } = usePreferences();

  const [selectedChatId, setSelectedChatId] = useState<string>('chat-1');
  const [inputText, setInputText] = useState('');

  const [chats, setChats] = useState([
    {
      id: 'chat-1',
      name: 'Nusali Bissau Eletrônicos (Vendedor Oficial)',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      isOfficial: true,
      lastMessage: 'Olá! O produto já foi despachado e você pode rastrear pelo código.',
      lastTime: '10:45',
      unreadCount: 0,
      messages: [
        { id: 'm1', sender: 'seller', text: 'Olá! Obrigado pela sua compra no Mercado Nusali.', time: '10:30' },
        { id: 'm2', sender: 'buyer', text: 'Boa tarde! Gostaria de saber quando será entregue em Bissau.', time: '10:35' },
        { id: 'm3', sender: 'seller', text: 'Olá! O produto já foi despachado e você pode rastrear pelo código.', time: '10:45' },
      ],
    },
    {
      id: 'chat-2',
      name: 'Nusali Assistente de Vendas AI',
      avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80',
      isAi: true,
      lastMessage: 'Posso tirar suas dúvidas sobre frete e garantia Escrow.',
      lastTime: 'Ontem',
      unreadCount: 1,
      messages: [
        { id: 'm20', sender: 'ai', text: 'Olá! Eu sou o Nusali Assistente. Como posso ajudar nas suas compras internacionais hoje?', time: 'Ontem' },
      ],
    },
  ]);

  const activeChat = chats.find(c => c.id === selectedChatId) || chats[0];

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMessage = {
      id: `msg-${Date.now()}`,
      sender: 'buyer' as const,
      text: inputText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChats(prev =>
      prev.map(c => {
        if (c.id === selectedChatId) {
          return {
            ...c,
            lastMessage: inputText,
            lastTime: userMessage.time,
            messages: [...c.messages, userMessage],
          };
        }
        return c;
      })
    );

    const sentText = inputText;
    setInputText('');

    // Simulate response
    setTimeout(() => {
      setChats(prev =>
        prev.map(c => {
          if (c.id === selectedChatId) {
            const replyMessage = {
              id: `msg-reply-${Date.now()}`,
              sender: c.isAi ? ('ai' as const) : ('seller' as const),
              text: c.isAi
                ? 'Entendido! Todas as transações no Mercado Nusali contam com retenção Escrow. Caso tenha qualquer divergência, nossa equipe devolve seu valor integralmente.'
                : 'Obrigado por nos contatar! Estamos verificando seu pacote com o operador logístico e atualizaremos o rastreio em breve.',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            return {
              ...c,
              lastMessage: replyMessage.text,
              lastTime: replyMessage.time,
              messages: [...c.messages, replyMessage],
            };
          }
          return c;
        })
      );
    }, 1000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fadeIn">
      <BuyerNavHeader />

      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden grid grid-cols-1 md:grid-cols-3 min-h-[600px]">
        {/* Left Inbox List */}
        <div className="border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-700" /> Mensagens
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">Conversas com vendedores e suporte Nusali</p>
          </div>

          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar conversa..."
                className="w-full pl-9 pr-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-xs focus:outline-hidden focus:bg-white"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {chats.map(chat => {
              const isSelected = chat.id === selectedChatId;
              return (
                <div
                  key={chat.id}
                  onClick={() => setSelectedChatId(chat.id)}
                  className={`p-4 cursor-pointer transition flex items-start gap-3 ${
                    isSelected ? 'bg-emerald-50/80 border-l-4 border-emerald-600' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="relative shrink-0">
                    <img src={chat.avatar} alt={chat.name} className="w-10 h-10 rounded-full object-cover border border-gray-200" referrerPolicy="no-referrer" />
                    {chat.isOfficial && (
                      <ShieldCheck className="w-4 h-4 text-emerald-600 bg-white rounded-full absolute -bottom-1 -right-1" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-gray-900 truncate flex items-center gap-1">
                        {chat.name}
                      </h3>
                      <span className="text-[10px] text-gray-400 font-mono">{chat.lastTime}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 truncate mt-0.5">{chat.lastMessage}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Active Chat Window */}
        <div className="md:col-span-2 flex flex-col bg-gray-50/50">
          {/* Chat Header */}
          <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={activeChat.avatar} alt={activeChat.name} className="w-10 h-10 rounded-full object-cover border border-gray-200" referrerPolicy="no-referrer" />
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  {activeChat.name}
                  {activeChat.isOfficial && (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.2 rounded font-black">
                      OFICIAL
                    </span>
                  )}
                  {activeChat.isAi && (
                    <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.2 rounded font-black flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-purple-700" /> IA ASSISTENTE
                    </span>
                  )}
                </h3>
                <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Ativo agora
                </span>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            {activeChat.messages.map((m) => {
              const isBuyer = m.sender === 'buyer';
              return (
                <div
                  key={m.id}
                  className={`flex ${isBuyer ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-md p-3.5 rounded-2xl text-xs leading-relaxed shadow-2xs ${
                      isBuyer
                        ? 'bg-emerald-600 text-white rounded-br-none'
                        : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'
                    }`}
                  >
                    <p className="font-medium">{m.text}</p>
                    <div className={`text-[9px] font-mono mt-1 text-right ${isBuyer ? 'text-emerald-100' : 'text-gray-400'}`}>
                      {m.time}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Message Input Box */}
          <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200 flex items-center gap-3">
            <button
              type="button"
              onClick={() => showToast('Anexo de foto/documento acionado.')}
              className="p-2 text-gray-500 hover:text-emerald-700 hover:bg-gray-100 rounded-xl transition"
              title="Anexar Comprovante ou Foto"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Escreva sua mensagem sobre o pedido..."
              className="flex-1 py-2.5 px-4 bg-gray-100 border border-gray-200 rounded-xl text-xs font-medium focus:outline-hidden focus:bg-white focus:border-emerald-600 transition"
            />

            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-xl shadow-xs transition"
              title="Enviar"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
