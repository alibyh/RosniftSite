import React, { useState, useEffect, useRef } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  TextField,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import { useChat } from '../contexts/ChatContext';
import './ChatPanel.css';

const DRAWER_WIDTH = 400;

const ChatPanel: React.FC = () => {
  const {
    conversations,
    activeConversationId,
    messages,
    loadingConversations,
    loadingMessages,
    isChatOpen,
    currentUserId,
    closeChat,
    setActiveConversationId,
    sendMessage,
  } = useChat();

  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Drawer
      anchor="right"
      open={isChatOpen}
      onClose={closeChat}
      variant="temporary"
      sx={{
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          bgcolor: '#141414',
          color: '#fff',
          borderLeft: '1px solid rgba(254,210,8,0.25)',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* ── VIEW 1: Conversations list ─────────────────────────────── */}
      {activeConversationId === null && (
        <Box className="chat-panel-view">
          {/* Header */}
          <Box className="chat-panel-header">
            <Typography variant="h6" className="chat-panel-title">
              Переписки
            </Typography>
            <IconButton onClick={closeChat} aria-label="close" sx={{ color: '#FED208' }}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Divider sx={{ borderColor: 'rgba(254,210,8,0.2)' }} />

          {/* List */}
          <Box className="chat-panel-list-body">
            {loadingConversations && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <CircularProgress size={28} sx={{ color: '#FED208' }} />
              </Box>
            )}
            {!loadingConversations && conversations.length === 0 && (
              <Typography
                variant="body2"
                sx={{ color: 'rgba(255,255,255,0.45)', p: 3, textAlign: 'center' }}
              >
                Нет активных переписок.
                <br />
                Переписка создаётся автоматически при оформлении заказа.
              </Typography>
            )}
            {!loadingConversations && (
              <List disablePadding>
                {conversations.map((c) => (
                  <React.Fragment key={c.id}>
                    <ListItemButton
                      onClick={() => setActiveConversationId(c.id)}
                      className="chat-panel-conv-item"
                    >
                      <ListItemText
                        primary={c.title}
                        secondary={new Date(c.created_at).toLocaleDateString('ru-RU')}
                        primaryTypographyProps={{
                          noWrap: true,
                          title: c.title,
                          sx: { color: '#fff', fontWeight: 500, fontSize: '0.95rem' },
                        }}
                        secondaryTypographyProps={{
                          sx: { color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem' },
                        }}
                      />
                    </ListItemButton>
                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)' }} />
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>
        </Box>
      )}

      {/* ── VIEW 2: Active conversation thread ─────────────────────── */}
      {activeConversationId !== null && (
        <Box className="chat-panel-view">
          {/* Header */}
          <Box className="chat-panel-header">
            <IconButton
              onClick={() => setActiveConversationId(null)}
              aria-label="back"
              sx={{ color: '#FED208', mr: 0.5 }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography
              variant="subtitle1"
              noWrap
              title={activeConversation?.title}
              sx={{ flex: 1, color: '#fff', fontWeight: 600, fontSize: '0.95rem' }}
            >
              {activeConversation?.title ?? '...'}
            </Typography>
            <IconButton onClick={closeChat} aria-label="close" sx={{ color: '#FED208' }}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Divider sx={{ borderColor: 'rgba(254,210,8,0.2)' }} />

          {/* Messages */}
          <Box className="chat-panel-messages">
            {loadingMessages && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <CircularProgress size={28} sx={{ color: '#FED208' }} />
              </Box>
            )}
            {!loadingMessages && messages.length === 0 && (
              <Typography
                variant="body2"
                sx={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', mt: 4 }}
              >
                Нет сообщений. Начните переписку.
              </Typography>
            )}
            {messages.map((m) => {
              const isOwn = m.sender_id === currentUserId;
              return (
                <Box
                  key={m.id}
                  className={`chat-bubble ${isOwn ? 'chat-bubble-own' : 'chat-bubble-other'}`}
                  sx={{
                    alignSelf: isOwn ? 'flex-end' : 'flex-start',
                    bgcolor: isOwn
                      ? 'rgba(254,210,8,0.18)'
                      : 'rgba(255,255,255,0.08)',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: '#FED208', display: 'block', fontWeight: 600, mb: 0.25 }}
                  >
                    {m.sender_name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#fff', whiteSpace: 'pre-wrap' }}>
                    {m.content}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: 'rgba(255,255,255,0.35)', display: 'block', mt: 0.5, textAlign: 'right', fontSize: '0.68rem' }}
                  >
                    {new Date(m.created_at).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Typography>
                </Box>
              );
            })}
            <div ref={messagesEndRef} />
          </Box>

          {/* Input */}
          <Box className="chat-panel-input-row">
            <TextField
              fullWidth
              multiline
              maxRows={4}
              size="small"
              placeholder="Сообщение…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: 'rgba(254,210,8,0.35)' },
                  '&:hover fieldset': { borderColor: 'rgba(254,210,8,0.55)' },
                  '&.Mui-focused fieldset': { borderColor: '#FED208' },
                },
              }}
            />
            <IconButton
              onClick={handleSend}
              disabled={!draft.trim()}
              sx={{ color: '#FED208', ml: 1, flexShrink: 0 }}
              aria-label="send"
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Box>
      )}
    </Drawer>
  );
};

export default ChatPanel;
