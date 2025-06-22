# SensAI - LeetCode Learning Assistant

A Chrome extension powered by Google's Gemini API to help you learn and solve LeetCode problems more effectively.
<img width="1705" alt="image" src="https://github.com/user-attachments/assets/9e4bc5b4-5af5-4531-b658-c5d20066385f" />

## Features

- **Next Step Mode**: Get step-by-step guidance on how to solve the current problem
- **Hint Mode**: Receive helpful hints without complete solutions
- **Multi-Language Support**: Works with:
  - Python
  - JavaScript
  - Java
  - C++
## Website to Install

<img width="618" alt="image" src="https://github.com/user-attachments/assets/ed683c3f-6170-4786-9ead-5963fa9a0545" />

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/SensAI.git
cd SensAI
```

2. Set up the backend:
```bash
cd backend
pip install -r requirements.txt
```

3. Configure your Gemini API key:
   - Create a `.env` file in the backend directory
   - Add your API key: `GEMINI_API_KEY=your_api_key_here`

4. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension` directory from this project

## Usage

1. Visit any LeetCode problem page
2. Click the SensAI extension icon
3. Select your preferred mode:
   - "Next Step" for guided solution steps
   - "Get Hint" for subtle hints
4. Choose your programming language
5. Click "Get Assistance"

## Project Structure

```
SensAI/
├── backend/
│   ├── server.py         # Flask server handling Gemini API requests
│   └── requirements.txt  # Python dependencies
├── extension/
│   ├── manifest.json     # Extension configuration
│   ├── popup/
│   │   ├── popup.html   # Extension popup interface
│   │   ├── styles.css   # Popup styling
│   │   └── script.js    # Popup functionality
│   └── content/
│       └── content.js   # LeetCode page interaction
└── README.md
```

## Backend API

The backend server provides two main endpoints:

- `/next_code`: Generates the next logical step in solving the problem
- `/hint`: Provides a helpful hint without giving away the solution

## Development

### Backend Requirements
- Python 3.8+
- Flask
- google-generativeai
- python-dotenv

### Extension Development
- The extension uses vanilla JavaScript
- Styling follows a dark theme with orange accents
- Uses Chrome's Extension Manifest V3

## Error Handling

The extension includes robust error handling for:
- API connection issues
- Code extraction failures
- Invalid responses
- Rate limiting

## Security

- API keys are stored server-side only
- No sensitive data is stored in the extension
- All API calls are made through the backend server

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Google's Gemini API for powering the AI assistance
- LeetCode for providing the platform for coding practice
- The open-source community for various tools and libraries used

## Support

For issues, questions, or contributions, please open an issue in the GitHub repository.
