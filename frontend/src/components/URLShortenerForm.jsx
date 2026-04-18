import React from 'react';
import { useTranslation } from '../lib/i18n';
import './URLShortenerForm.css';

const URLShortenerForm = ({ onSubmit, isLoading, error }) => {
  const { t: translate } = useTranslation();
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
          {translate('urlShortenerForm.label')}
        </label>
        <input
          id="url-input"
          type="url"
          className="url-input"
          placeholder={translate('urlShortenerForm.placeholder')}
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
        <span className="btn-text">{translate('urlShortenerForm.button')}</span>
      </button>

      <div className="status-bar">
        <div className="status-indicator">
          <span className="status-dot"></span>
          <span className="status-text">{translate('urlShortenerForm.status.ready')}</span>
        </div>
        <span className="status-text">{translate('urlShortenerForm.status.encrypted')}</span>
      </div>
    </form>
  );
};

export default URLShortenerForm;