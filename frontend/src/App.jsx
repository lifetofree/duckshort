import React, { useState } from 'react';
import URLShortenerForm from './components/URLShortenerForm';
import Modal from './components/Modal';
import logo from './assets/logo.png';
import './App.css';

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [shortUrl, setShortUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleShorten = async (url) => {
    if (!isValidUrl(url)) {
      setError('Invalid URL format');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/shorten', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': 'your-secret-token'
        },
        body: JSON.stringify({ longUrl: url })
      });

      const data = await response.json();

      if (data.success) {
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
      await navigator.clipboard.writeText(shortUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = shortUrl;
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