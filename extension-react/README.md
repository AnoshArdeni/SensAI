# SensAI Chrome Extension - React + TypeScript Version

This is a modern React + TypeScript version of the SensAI Chrome Extension that provides AI-powered coding assistance for LeetCode problems.

## 🚀 Features

- **Modern Tech Stack**: Built with React 18, TypeScript, and Vite
- **Type Safety**: Full TypeScript support with Chrome extension APIs
- **Custom Hooks**: Reusable hooks for Chrome storage and LeetCode integration
- **Responsive UI**: Maintains the original design while being more maintainable
- **Hot Reload**: Development server with hot module replacement

## 📁 Project Structure

```
extension-react/
├── manifest.json                 # Chrome extension manifest
├── background.js                 # Background service worker
├── content/
│   └── content.js               # Content script (copied from original)
├── popup/                       # React + TypeScript popup
│   ├── src/
│   │   ├── components/
│   │   │   ├── Popup.tsx        # Main popup component
│   │   │   └── Popup.css        # Popup styles
│   │   ├── hooks/
│   │   │   ├── useChromeStorage.ts    # Chrome storage hook
│   │   │   └── useLeetCodeProblem.ts  # LeetCode integration hook
│   │   ├── types/
│   │   │   └── chrome.ts        # TypeScript type definitions
│   │   ├── App.tsx              # Root component
│   │   ├── main.tsx            # Entry point
│   │   └── index.css           # Global styles
│   ├── dist/                   # Built files (generated)
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
└── README.md
```

## 🛠️ Development Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Chrome browser

### Installation

1. **Clone and navigate to the project:**
   ```bash
   cd SensAI/extension-react
   ```

2. **Install dependencies:**
   ```bash
   cd popup
   npm install
   ```

3. **Build the extension:**
   ```bash
   npm run build
   ```

### Development

1. **Start development server (optional for live editing):**
   ```bash
   npm run dev
   ```

2. **Build for production:**
   ```bash
   npm run build
   ```

## 📦 Loading the Extension

1. **Build the project** (if not already done):
   ```bash
   cd popup
   npm run build
   ```

2. **Open Chrome and go to:**
   ```
   chrome://extensions/
   ```

3. **Enable Developer mode** (toggle in top right)

4. **Click "Load unpacked"** and select the `extension-react` folder

5. **Navigate to a LeetCode problem** (e.g., https://leetcode.com/problems/two-sum/)

6. **Click the extension icon** in your toolbar to open the popup

## 🔧 Backend Requirements

This extension requires a backend server running at `http://localhost:8000` with the following endpoint:

```
POST /api/assist
Content-Type: application/json

{
  "problem_name": string,
  "code_so_far": string,
  "language": string,
  "mode": "next_code" | "hint"
}
```

## 🎯 Key Improvements over Original

### Type Safety
- Full TypeScript support with proper type definitions
- Chrome extension API types
- Compile-time error checking

### Modern React Patterns
- Functional components with hooks
- Custom hooks for Chrome APIs
- Proper state management

### Development Experience
- Hot module replacement during development
- ESLint and TypeScript checking
- Modern build tooling with Vite

### Code Organization
- Modular component structure
- Separation of concerns
- Reusable hooks and utilities

## 📱 Usage

1. **Navigate to any LeetCode problem page**
2. **Click the extension icon** to open the popup
3. **Select your preferred programming language**
4. **Choose mode:**
   - **Code**: Get the next step in solving the problem
   - **Hint**: Get a helpful hint without full solution
5. **Click the send button** to get AI assistance
6. **Copy responses** using the copy button

## 🔄 Comparison with Original

| Feature | Original | React + TypeScript |
|---------|----------|-------------------|
| Framework | Vanilla JS | React + TypeScript |
| Type Safety | None | Full TypeScript |
| State Management | Global variables | React hooks |
| Code Organization | Single files | Modular components |
| Development | Manual refresh | Hot reload |
| Maintainability | Medium | High |
| Performance | Good | Good |

## 🤝 Contributing

1. Make changes in the `src/` directory
2. Test your changes with `npm run dev`
3. Build with `npm run build`
4. Load the extension in Chrome for testing
5. Submit your changes

## 🐛 Troubleshooting

### Extension not loading
- Ensure you've run `npm run build` in the popup directory
- Check that `dist/` folder exists with built files
- Reload the extension in Chrome extensions page

### TypeScript errors
- Run `npm run build` to see TypeScript compilation errors
- Check that all imports use proper type imports where needed

### Backend connection issues
- Ensure your backend server is running at `http://localhost:8000`
- Check browser console for network errors
- Verify CORS settings on your backend

## 📄 License

Same license as the main SensAI project. 