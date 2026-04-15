# 🦆 Duck Short - Neon Cyberpunk URL Shortener

A mobile-first, futuristic URL shortener built with React and Vite, featuring a stunning neon cyberpunk theme.

## ✨ Features

- 🎨 **Neon Cyberpunk Theme** - Dark background with glowing cyan, magenta, and purple accents
- 📱 **Mobile-First Design** - Fully responsive, optimized for all screen sizes
- ⚡ **Fast & Simple** - Clean, intuitive interface for quick URL shortening
- 📋 **One-Click Copy** - Easily copy shortened links to clipboard
- 🎯 **URL Validation** - Automatic validation for valid URLs
- ✨ **Smooth Animations** - Beautiful transitions and hover effects
- 🔒 **Secure** - Token-based authentication for API calls

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ installed
- npm or yarn package manager

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Start the development server:**
```bash
npm run dev
```

3. **Open your browser:**
Navigate to `http://localhost:3000`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## 🎨 Theme Customization

The neon cyberpunk theme uses CSS custom properties. You can customize colors in [`src/index.css`](src/index.css):

```css
:root {
  --bg-primary: #0a0a0f;        /* Deep dark background */
  --bg-secondary: #12121a;      /* Slightly lighter for cards */
  --bg-tertiary: #1a1a25;       /* Input backgrounds */
  --neon-cyan: #00f5ff;         /* Primary accent */
  --neon-magenta: #ff00ff;      /* Secondary accent */
  --neon-purple: #bf00ff;       /* Tertiary accent */
  --text-primary: #ffffff;      /* Main text */
  --text-secondary: #a0a0b0;    /* Secondary text */
  --error: #ff3366;             /* Error state */
  --success: #00ff88;           /* Success state */
}
```

## 🔧 Configuration

### API Endpoint

The app expects the API endpoint at `/shorten`. Update the API call in [`src/App.jsx`](src/App.jsx:38) to match your backend:

```javascript
const response = await fetch('/shorten', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Auth-Token': 'your-secret-token' // Replace with your actual token
  },
  body: JSON.stringify({
    longUrl: url
  })
});
```

### Expected API Response

```json
{
  "success": true,
  "shortUrl": "https://your-domain.com/abc123",
  "id": "abc123"
}
```

## 📁 Project Structure

```
duck-short/
├── public/
│   └── vite.svg
├── src/
│   ├── components/
│   │   ├── Modal.jsx          # Modal component for displaying shortened links
│   │   ├── Modal.css
│   │   ├── URLShortenerForm.jsx  # Form component for URL input
│   │   └── URLShortenerForm.css
│   ├── App.jsx                # Main application component
│   ├── App.css
│   ├── main.jsx               # Application entry point
│   └── index.css              # Global styles and theme
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## 🎯 How It Works

1. **Enter URL** - User enters a long URL in the input field
2. **Validate** - The app validates the URL format
3. **Shorten** - Sends a POST request to the `/shorten` endpoint
4. **Display** - Shows the shortened link in a modal
5. **Copy** - User can copy the link with one click
6. **Close** - Closing the modal clears the input for the next URL

## 🌐 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 📱 Responsive Breakpoints

- **Mobile**: 320px - 767px
- **Tablet**: 768px - 1023px
- **Desktop**: 1024px+

## 🎨 Design Features

### Neon Glow Effects
- Buttons and inputs have glowing borders on hover/focus
- Smooth transitions for all interactive elements
- Gradient backgrounds for visual depth

### Animations
- Modal fade-in and slide-up effects
- Button hover animations with shine effect
- Loading spinner for async operations
- Pulsing logo animation

### Accessibility
- Semantic HTML elements
- ARIA labels for buttons
- Keyboard navigation support
- Focus indicators
- Sufficient color contrast

## 🔐 Security Notes

- The `X-Auth-Token` should be stored securely (environment variables)
- Never commit sensitive tokens to version control
- Use HTTPS in production
- Implement rate limiting on the backend

## 🚀 Deployment

### Vercel
```bash
npm install -g vercel
vercel
```

### Netlify
```bash
npm run build
# Upload the dist folder to Netlify
```

### Cloudflare Pages
```bash
npm run build
# Upload the dist folder to Cloudflare Pages
```

## 📝 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues and questions, please open an issue on the repository.

---

Built with ❤️ using React, Vite, and Neon Cyberpunk aesthetics
# updated
