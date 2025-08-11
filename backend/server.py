from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import json
import sys
from hint_generator import HintGenerator
import traceback
from typing import Optional, List
from datetime import datetime

# Load environment variables from .env file
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="SensAI Code Learning Assistant")

# Add CORS middleware to allow requests from the extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://leetcode.com", 
        "https://*.leetcode.com",
        "http://localhost:8000",  # Node.js backend
        "http://localhost:9002",  # Website
        "chrome-extension://*"    # Chrome extensions
    ],
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
    max_retries: int = None  # Override default retry count (None = use default based on use_evaluation)
    user_id: Optional[str] = None

class UserProgress(BaseModel):
    user_id: str
    problem_id: str
    problem_title: str
    problem_url: str
    completed: bool = False
    attempts: int = 0
    hints_used: int = 0
    time_spent: int = 0
    last_attempted: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class UserStats(BaseModel):
    user_id: str
    total_problems_attempted: int
    total_problems_completed: int
    total_hints_used: int
    total_time_spent: int

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
        
        # Determine retry count: explicit override, or default based on evaluation setting
        if request.max_retries is not None:
            retry_count = request.max_retries
        else:
            retry_count = 2 if request.use_evaluation else 0
        
        result = hint_generator.generate_and_evaluate(
            problem_name=problem_name,
            code_so_far=code_so_far,
            language=language,
            mode=gen_mode,
            threshold=3.0,  # Retry if score < 3.0
            max_retries=retry_count,
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
            
            # Build response with optional detailed evaluation
            response_data = {
                "success": True,
                "response": final_content,
                "final_parsed": result.get('final_parsed'),  # Include parsed JSON
                "evaluation_score": result['final_evaluation'].get('overall_score', result['final_evaluation'].get('score', 0)) if result['final_evaluation'] else None,
                "attempts": len(result['attempts']),
                "pipeline": pipeline_desc
            }
            
            # Only include detailed evaluation if evaluation was actually performed
            if request.use_evaluation and result.get('final_evaluation'):
                response_data["detailed_evaluation"] = result['final_evaluation']
            
            return response_data
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

# User progress tracking endpoints
@app.post("/api/progress/track")
async def track_progress(progress: UserProgress):
    """
    Track user progress on a problem
    Note: In a real implementation, this would connect to Firebase or another database
    """
    try:
        # Here you would save to your database
        # For now, we'll just return success
        return {
            "success": True,
            "message": "Progress tracked successfully",
            "data": progress.dict()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to track progress: {e}")

@app.get("/api/progress/{user_id}")
async def get_user_progress(user_id: str):
    """
    Get all progress for a specific user
    """
    try:
        # Here you would fetch from your database
        # For now, return mock data
        mock_progress = [
            {
                "problem_id": "two-sum",
                "problem_title": "Two Sum",
                "completed": True,
                "attempts": 2,
                "hints_used": 1,
                "last_attempted": datetime.now().isoformat()
            }
        ]
        
        return {
            "success": True,
            "progress": mock_progress
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get progress: {e}")

@app.get("/api/stats/{user_id}")
async def get_user_stats(user_id: str):
    """
    Get user statistics
    """
    try:
        # Here you would calculate from your database
        mock_stats = {
            "total_problems_attempted": 5,
            "total_problems_completed": 3,
            "total_hints_used": 7,
            "total_time_spent": 3600  # in seconds
        }
        
        return {
            "success": True,
            "stats": mock_stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001) 