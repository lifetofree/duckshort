import React from 'react';
import './URLShortenerForm.css';

const URLShortenerForm = ({ onSubmit, isLoading, error }) => {
  const [url, setUrl] = React.useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (url.trim()) {
      await onSubmit(url);
    }
  };

  return (
    <form className="url-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="url-input" className="form-label">
          SOURCE_URL_INPUT
        </label>
        <input
          id="url-input"
          type="url"
          className="url-input"
          placeholder="https://secure.standard.net/tracking/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isLoading}
          required
        />
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <button 
        type="submit" 
        className="shorten-button"
        disabled={!url.trim()}
      >
        <span className="btn-text">EXECUTE FRAGMENTATION</span>
      </button>

      <div className="status-bar">
        <div className="status-indicator">
          <span className="status-dot"></span>
          <span className="status-text">SYSTEM_READY</span>
        </div>
        <span className="status-text">ENCRYPTED_CHANNEL_V2</span>
      </div>
    </form>
  );
};

export default URLShortenerForm;