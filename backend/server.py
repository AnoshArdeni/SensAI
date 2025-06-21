from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai
import os
import json

# Load environment variables from .env file
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("Missing GEMINI_API_KEY in .env file")

# System prompts for different modes
CODE_SYSTEM_PROMPT = """System: You are Gemini, an expert AI coding assistant.
When given a JSON with:
- "problem_name": the LeetCode title
- "code_so_far": the user's partial code
- "language": the programming language to use

Respond with exactly one JSON object:
  • Key: "next_code"
  • Value: the minimal {language} snippet to advance the solution, including a brief inline comment explaining what it does

Do NOT:
  • Echo or restate the problem_name
  • Provide full function definitions
  • Include explanations beyond the inline comment
  • Use markdown fences or extra JSON keys"""

HINT_SYSTEM_PROMPT = """System: You are Gemini, a senior engineer mentor.
When given a JSON with:
- "problem_name": the LeetCode title
- "code_so_far": the user's partial code
- "language": the programming language being used

Respond with exactly one JSON object:
  • Key: "hint"
  • Value: a concise, plain-English next step tailored to correct or advance their implementation

Do NOT:
  • Echo or restate the problem_name or code content
  • Include any code blocks
  • Provide lengthy tutorials—only the immediate next action"""

# Initialize Gemini client
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash')

# Initialize FastAPI app
app = FastAPI(title="Code Learning Assistant")

class AssistRequest(BaseModel):
    problem_name: str
    code_so_far: str = ""
    language: str = "python"
    mode: str  # "next_code" or "hint"

@app.post("/api/assist")
async def get_assistance(request: AssistRequest):
    """
    Generate coding assistance based on mode:
    - next_code: return next code snippet to advance solution
    - hint: return strategy hint in plain English
    """
    if request.mode not in ["next_code", "hint"]:
        raise HTTPException(status_code=400, detail="mode must be 'next_code' or 'hint'")

    # Prepare the input JSON for the model
    input_json = {
        "problem_name": request.problem_name,
        "code_so_far": request.code_so_far,
        "language": request.language
    }

    # Select appropriate system prompt based on mode
    system_prompt = CODE_SYSTEM_PROMPT.format(language=request.language) if request.mode == "next_code" else HINT_SYSTEM_PROMPT

    try:
        # Format the complete prompt
        prompt = f"{system_prompt}\n\nUser:\n{json.dumps(input_json)}\nAssistant:"
        
        response = model.generate_content(
            prompt,
            generation_config={
                "temperature": 0.2,
                "max_output_tokens": 500,
            }
        )

        # Parse the response as JSON
        try:
            response_json = json.loads(response.text)
            return {
                "success": True,
                "response": response_json.get("next_code" if request.mode == "next_code" else "hint", "")
            }
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="Invalid JSON response from model")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API error: {e}")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 