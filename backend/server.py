from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai
import os
import json
import traceback
import sys

# Load environment variables from .env file
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("Missing GEMINI_API_KEY in .env file")

# Initialize Gemini client
try:
    print("\nInitializing Gemini API...")
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    # Test the API with a simple call
    print("Testing Gemini API with a simple call...")
    test_response = model.generate_content("Say 'API test successful' if you can read this.")
    print(f"Test response: {test_response.text}")
    if not test_response.text:
        raise Exception("Empty response from Gemini API test call")
    print("Gemini API initialization successful!")
except Exception as e:
    error_msg = f"""
Error initializing Gemini API:
Error type: {type(e).__name__}
Error message: {str(e)}
Full traceback:
{traceback.format_exc()}
Please check:
1. Your API key is correct
2. You have access to the gemini-2.5-flash model
3. Your internet connection is working
"""
    print(error_msg)
    raise RuntimeError(error_msg)

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
    try:
        if request.mode not in ["next_code", "hint"]:
            raise HTTPException(status_code=400, detail="mode must be 'next_code' or 'hint'")

        # Print request details for debugging
        print(f"\nReceived request:")
        print(f"Mode: {request.mode}")
        print(f"Language: {request.language}")
        print(f"Problem: {request.problem_name}")
        print(f"Code length: {len(request.code_so_far)} characters")

        # Prepare the input JSON for the model
        input_json = {
            "problem_name": request.problem_name,
            "code_so_far": request.code_so_far,
            "language": request.language
        }

        # Select appropriate system prompt based on mode
        system_prompt = CODE_SYSTEM_PROMPT.format(language=request.language) if request.mode == "next_code" else HINT_SYSTEM_PROMPT

        # Format the complete prompt
        prompt = f"{system_prompt}\n\nUser:\n{json.dumps(input_json)}\nAssistant:"
        print(f"\nSending prompt to Gemini:")
        print(prompt)

        try:
            # Generate response from Gemini
            print("\nCalling Gemini API...")
            response = model.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.2,
                    "max_output_tokens": 500,
                }
            )
            if not response.text:
                raise Exception("Empty response received from Gemini API")
                
            print(f"\nReceived response from Gemini:")
            print(response.text)

            # Parse the response
            response_text = response.text.strip()
            
            # For hint mode, try to extract a clean hint
            if request.mode == "hint":
                # Remove code blocks
                response_text = response_text.replace('```', '')
                # Try to find JSON first
                try:
                    response_json = json.loads(response_text)
                    if "hint" in response_json:
                        return {"success": True, "response": response_json["hint"]}
                except json.JSONDecodeError:
                    # If not JSON, clean up the text
                    hint = response_text.replace('{', '').replace('}', '').replace('"', '')
                    hint = ' '.join(hint.split())  # Normalize whitespace
                    return {"success": True, "response": hint}

            # For next_code mode, parse as JSON
            else:
                try:
                    response_json = json.loads(response_text)
                    return {
                        "success": True,
                        "response": response_json.get("next_code", response_text)
                    }
                except json.JSONDecodeError as e:
                    print(f"JSON parse error: {str(e)}")
                    print(f"Attempted to parse: {response_text}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Invalid JSON response from Gemini: {response_text[:100]}..."
                    )

        except Exception as e:
            error_msg = f"""
Error processing Gemini response:
Error type: {type(e).__name__}
Error message: {str(e)}
Full traceback:
{traceback.format_exc()}
"""
            print(error_msg)
            raise HTTPException(
                status_code=500,
                detail=error_msg
            )

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        error_msg = f"""
Unhandled error in get_assistance:
Error type: {type(e).__name__}
Error message: {str(e)}
Full traceback:
{traceback.format_exc()}
"""
        print(error_msg)
        raise HTTPException(
            status_code=500,
            detail=error_msg
        )

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 