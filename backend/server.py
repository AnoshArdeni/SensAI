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

# Initialize Gemini client
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-pro')

# Initialize FastAPI app
app = FastAPI(title="Code Learning Assistant")

class AssistRequest(BaseModel):
    problem_description: str
    language: str = "python"
    mode: str  # "starter" or "hint"
    current_code: str = ""

@app.post("/api/assist")
async def get_assistance(request: AssistRequest):
    """
    Generate coding assistance based on mode:
    - starter: return starter code template
    - hint: return strategy in plain English
    """
    if request.mode not in ["starter", "hint"]:
        raise HTTPException(status_code=400, detail="mode must be 'starter' or 'hint'")

    if request.mode == "starter":
        system_msg = """System: You are Gemini, an expert coding mentor.
When given a coding problem description, provide a starter code template that:
1. Includes the basic function/class structure
2. Has helpful comments explaining what needs to be implemented
3. Includes necessary imports
4. Does NOT provide the actual solution logic

Focus on giving students a good foundation while letting them implement the core algorithm themselves."""

        user_content = f"""Problem: {request.problem_description}
Language: {request.language}

Provide a starter code template."""

    else:  # hint mode
        system_msg = """System: You are Gemini, a senior engineer mentor.
When given a coding problem and partial implementation:
1. Provide a concise, strategic hint about the next step
2. Don't give away the complete solution
3. Focus on guiding principles and approach
4. Point out potential issues or improvements
5. Break down complex steps into smaller ones

Help students learn by guiding them to discover the solution themselves."""

        user_content = f"""Problem: {request.problem_description}
Language: {request.language}
Current Code:
{request.current_code or 'No code yet'}

What would be a helpful next step?"""

    try:
        response = model.generate_content(
            f"{system_msg}\n\n{user_content}",
            generation_config={
                "temperature": 0.2,
                "max_output_tokens": 500,
            }
        )
        return {
            "success": True,
            "response": response.text.strip()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API error: {e}")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 