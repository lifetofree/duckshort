import React, { useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import URLShortenerForm from './components/URLShortenerForm';
import Modal from './components/Modal';
import logo from './assets/logo.png';
import './App.css';

interface ShortenResponse {
  success: boolean;
  shortUrl?: string;
  error?: string;
}

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const isValidUrl = (string: string): boolean => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleShorten = async (url: string) => {
    if (!isValidUrl(url)) {
      setError('Invalid URL format');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_ADMIN_SECRET || 'dev-secret'}`
        },
        body: JSON.stringify({ url })
      });

      const data: ShortenResponse = await response.json();

      if (data.shortUrl) {
        setShortUrl(data.shortUrl);
        setIsModalOpen(true);
      } else {
        setError(data.error || 'Failed to shorten URL');
      }
    } catch (err) {
      setError('Network error. Check connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shortUrl!);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = shortUrl!;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        console.error('Copy failed:', err);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setShortUrl(null);
    setCopySuccess(false);
    setError(null);
  };

  return (
    <>
      <div className="bg-overlay"></div>
      <div className="app">
        <header className="app-header">
          <img src={logo} alt="Duck Logo" className="logo" />
          <h1 className="logo-text">ADDUCKIVITY</h1>
          <div className="protocol-tag">
            <span className="indicator"></span>
            <span>PROTOCOL_FRAGMENT_V4.2</span>
          </div>
        </header>

        <main className="app-main">
          <URLShortenerForm 
            onSubmit={handleShorten}
            isLoading={isLoading}
            error={error}
          />
        </main>

        <footer className="app-footer">
          <p>ENCRYPTED_CHANNEL_V2</p>
        </footer>
      </div>

      <Modal
        isOpen={isModalOpen}
        shortUrl={shortUrl}
        onClose={handleCloseModal}
        onCopy={handleCopy}
        copySuccess={copySuccess}
      />
    </>
  );
}

export default App;