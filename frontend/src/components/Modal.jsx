import React from 'react';
import './Modal.css';

const Modal = ({ isOpen, shortUrl, onClose, onCopy, copySuccess }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="modal-header">
          <h2 className="modal-title">Fragment Created</h2>
        </div>

        <div className="modal-body">
          <div>
            <p className="modal-label">Shortened URL</p>
            <div className="short-url-container">
              <input
                type="text"
                className="short-url-input"
                value={shortUrl || ''}
                readOnly
              />
            </div>
          </div>

          <button 
            className={`copy-button ${copySuccess ? 'copied' : ''}`}
            onClick={onCopy}
          >
            <span className="material-symbols-outlined">
              {copySuccess ? 'check' : 'content_copy'}
            </span>
            <span>{copySuccess ? 'Copied!' : 'Copy to Clipboard'}</span>
          </button>
        </div>

        <div className="modal-status-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="status-dot"></span>
            <span>Transfer_Complete</span>
          </div>
          <span>Channel_Secured</span>
        </div>
      </div>
    </div>
  );
};

export default Modal;