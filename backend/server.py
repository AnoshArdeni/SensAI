from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import json
import sys
from hint_generator import HintGenerator

# Load environment variables from .env file
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="SensAI Code Learning Assistant")

# Add CORS middleware to allow requests from the extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://leetcode.com", "https://*.leetcode.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Initialize HintGenerator for the Claude + GPT pipeline
try:
    hint_generator = HintGenerator()
except Exception as e:
    print(f"Error: HintGenerator initialization failed: {e}")
    print("Make sure CLAUDE_API_KEY and OPENAI_API_KEY are set in .env file.")
    sys.exit(1)

class ProcessRequest(BaseModel):
    problem: dict  # Contains title, description, code from extension
    mode: str  # "code" or "hint"
    use_evaluation: bool = False  # Whether to use GPT evaluation (default: False for speed)

@app.post("/process")
async def process_request(request: ProcessRequest):
    """
    Main endpoint called by the extension.
    Uses Claude + GPT pipeline with evaluation and retry logic.
    """
    try:
        # Extract data from extension request
        problem_name = request.problem.get('title', 'Unknown Problem')
        code_so_far = request.problem.get('code', '')
        language = "python"  # Default to Python for now
        
        # Convert extension mode to generator mode
        if request.mode == "code":
            gen_mode = "next_code"
        elif request.mode == "hint":
            gen_mode = "hint"
        else:
            raise HTTPException(status_code=400, detail="Mode must be 'code' or 'hint'")
        
        result = hint_generator.generate_and_evaluate(
            problem_name=problem_name,
            code_so_far=code_so_far,
            language=language,
            mode=gen_mode,
            threshold=3.0,  # Retry if score < 3.0
            max_retries=2 if request.use_evaluation else 0,  # No retries without evaluation
            use_evaluation=request.use_evaluation
        )
        
        if result['success'] and result['final_response']:
            
            # Parse the final response to extract just the content
            final_response = result['final_response']
            
            # Try to parse JSON and extract the relevant field
            try:
                response_json = json.loads(final_response)
                if gen_mode == "hint" and "hint" in response_json:
                    final_content = response_json["hint"]
                elif gen_mode == "next_code" and "next_code" in response_json:
                    final_content = response_json["next_code"]
                else:
                    final_content = final_response
            except json.JSONDecodeError:
                # If not JSON, use the response as-is
                final_content = final_response
            
            pipeline_desc = "Claude only" if not request.use_evaluation else "Claude + GPT with evaluation"
            return {
                "success": True,
                "response": final_content,
                "final_parsed": result.get('final_parsed'),  # Include parsed JSON
                "evaluation_score": result['final_evaluation'].get('score', 0) if result['final_evaluation'] else None,
                "attempts": len(result['attempts']),
                "pipeline": pipeline_desc
            }
        else:
            # Provide detailed error information from attempts
            error_details = []
            for attempt in result['attempts']:
                claude_error = attempt['claude_result'].get('error')
                gpt_error = attempt['gpt_evaluation'].get('error') if attempt['gpt_evaluation'] else None
                
                if claude_error:
                    error_details.append(f"Claude: {claude_error}")
                if gpt_error:
                    error_details.append(f"Evaluation: {gpt_error}")
            
            detailed_error = "; ".join(error_details) if error_details else "Unknown failure"
            
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate satisfactory response. Details: {detailed_error}"
            )
        
    except Exception as e:
        error_msg = f"Error processing request: {str(e)}"
        raise HTTPException(
            status_code=500,
            detail=error_msg
        )

@app.get("/health")
async def health_check():
    return {"status": "healthy", "pipeline": "Claude + GPT"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 