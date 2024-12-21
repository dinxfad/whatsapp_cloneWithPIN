import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { supabase } from '../lib/supabase';
import { Profile } from '../types/database';
import { LogOut, Plus, Send } from 'lucide-react';
import { format } from 'date-fns';

export default function Chat() {
  const { user, signOut } = useAuthStore();
  const { chats, currentChat, setCurrentChat, sendMessage, fetchChats, subscribeToChats } = useChatStore();
  const [connections, setConnections] = useState<Profile[]>([]);
  const [message, setMessage] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);
  const [pinToAdd, setPinToAdd] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      fetchConnections();
      subscribeToChats(user.id);
    }
  }, [user]);

  useEffect(() => {
    if (user && currentChat) {
      fetchChats(user.id, currentChat.id);
    }
  }, [currentChat]);

  const fetchConnections = async () => {
    const { data, error } = await supabase
      .from('connections')
      .select('connected_user_id, profiles:connected_user_id(*)')
      .eq('user_id', user!.id);

    if (error) {
      console.error('Error fetching connections:', error);
      return;
    }

    setConnections(data.map((conn) => conn.profiles));
  };

  const handleAddContact = async () => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('private_pin', pinToAdd)
        .single();

      if (profileError || !profile) {
        setError('User not found with this PIN');
        return;
      }

      if (profile.id === user!.id) {
        setError('You cannot add yourself');
        return;
      }

      const { error: connectionError } = await supabase
        .from('connections')
        .insert([
          {
            user_id: user!.id,
            connected_user_id: profile.id,
          },
        ]);

      if (connectionError) {
        setError('Failed to add contact');
        return;
      }

      setShowAddContact(false);
      setPinToAdd('');
      fetchConnections();
    } catch (err) {
      setError('An error occurred');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !currentChat) return;

    try {
      await sendMessage(message, currentChat.id);
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-1/4 bg-white border-r">
        <div className="p-4 border-b flex justify-between items-center">
          <div>
            <h2 className="font-semibold">{user?.display_name}</h2>
            <p className="text-sm text-gray-500">PIN: {user?.private_pin}</p>
          </div>
          <button
            onClick={() => signOut()}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <LogOut className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4">
          <button
            onClick={() => setShowAddContact(true)}
            className="w-full flex items-center justify-center space-x-2 p-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            <Plus className="w-5 h-5" />
            <span>Add Contact</span>
          </button>
        </div>

        <div className="overflow-y-auto">
          {connections.map((connection) => (
            <button
              key={connection.id}
              onClick={() => setCurrentChat(connection)}
              className={`w-full p-4 text-left hover:bg-gray-50 ${
                currentChat?.id === connection.id ? 'bg-gray-50' : ''
              }`}
            >
              <div className="font-medium">{connection.display_name}</div>
              <div className="text-sm text-gray-500">PIN: {connection.private_pin}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentChat ? (
          <>
            <div className="p-4 bg-white border-b">
              <h2 className="font-semibold">{currentChat.display_name}</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chats.map((chat) => {
                const isOwn = chat.sender_id === user?.id;
                return (
                  <div
                    key={chat.id}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        isOwn
                          ? 'bg-green-600 text-white'
                          : 'bg-white border'
                      }`}
                    >
                      <p>{chat.message}</p>
                      <p className={`text-xs mt-1 ${isOwn ? 'text-green-100' : 'text-gray-500'}`}>
                        {format(new Date(chat.created_at), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSendMessage} className="p-4 bg-white border-t">
              <div className="flex space-x-4">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message"
                  className="flex-1 border rounded-md px-4 py-2 focus:outline-none focus:border-green-500"
                />
                <button
                  type="submit"
                  className="bg-green-600 text-white p-2 rounded-md hover:bg-green-700"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a contact to start chatting
          </div>
        )}
      </div>

      {/* Add Contact Modal */}
      {showAddContact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Add Contact by PIN</h3>
            {error && (
              <div className="mb-4 text-sm text-red-500 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}
            <input
              type="text"
              value={pinToAdd}
              onChange={(e) => setPinToAdd(e.target.value)}
              placeholder="Enter PIN"
              className="w-full border rounded-md px-4 py-2 mb-4 focus:outline-none focus:border-green-500"
            />
            <div className="flex space-x-4">
              <button
                onClick={() => {
                  setShowAddContact(false);
                  setError('');
                  setPinToAdd('');
                }}
                className="flex-1 px-4 py-2 border rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddContact}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}