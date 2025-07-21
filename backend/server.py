from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai
from google.generativeai.types import GenerationConfig
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
    
    # Handle test response properly with try-catch
    test_text = ""
    try:
        # Try the simple text accessor first
        if hasattr(test_response, 'text'):
            test_text = test_response.text
        else:
            raise ValueError("No text attribute")
    except (ValueError, AttributeError):
        # Fall back to parts accessor for complex responses
        try:
            if test_response.candidates and len(test_response.candidates) > 0:
                parts = test_response.candidates[0].content.parts
                test_text = ''.join([part.text for part in parts if hasattr(part, 'text')])
            else:
                test_text = "API test failed - no candidates"
        except Exception as parts_error:
            print(f"Error accessing test response parts: {parts_error}")
            test_text = "API test failed - could not extract text"
    
    print(f"Test response: {test_text}")
    if not test_text:
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
HINT_SYSTEM_PROMPT = """You are a coding mentor. Analyze the user's code and provide a single helpful hint.

Look at this code and give one specific suggestion for what to do next:

Code:
{{USER_CODE}}

Language: {{PROGRAMMING_LANGUAGE}}

Respond with only this JSON format:
{"hint":"your specific suggestion here"}

Keep your hint concise and actionable."""

CODE_SYSTEM_PROMPT = """System: YOU ARE GEMINI, AN EXPERT AI CODING ASSISTANT WITH DEEP KNOWLEDGE OF DATA STRUCTURES AND ALGORITHMS.
When given the following input:

<problem_name>
{{PROBLEM_NAME}}
</problem_name>

<code_so_far>
{{USER_CODE}}
</code_so_far>

<language>
{{PROGRAMMING_LANGUAGE}}
</language>

1. ANALYZE <code_so_far> AND CLASSIFY THE USER STATE (JUST STARTING; WRONG APPROACH; MID-IMPLEMENTATION GAP; MINOR BUG/OFF-BY-ONE; PERFORMANCE BOTTLENECK; EDGE-CASE MISSING; DEBUGGING AID; RECURSION/MEMO ISSUE; FINISHING TOUCHES; SYNTAX ERROR).
2. IF APPLICABLE, THINK IN TERMS OF ONE ALGORITHMIC PATTERN (DFS; DYNAMIC PROGRAMMING; BACKTRACKING; HEAP; ARRAYS; BINARY SEARCH; BFS; TWO POINTERS; SLIDING WINDOW; FAST & SLOW POINTERS; TRIE; GREEDY; GRAPH; IN-PLACE LINKED-LIST REVERSAL; INTERVALS; TOPOLOGICAL SORT; BIT MANIPULATION; UNION FIND; DESIGN; SORTING; QUICKSELECT; BUCKET SORT).
3. CHOOSE THE SINGLE MOST IMPACTFUL NEXT STEP FROM YOUR CLASSIFICATION.

**CRITICAL: ALWAYS USE BOTH SCENARIO CLASSIFICATION AND PATTERN IDENTIFICATION TOGETHER TO PROVIDE THE MOST TARGETED GUIDANCE.**

RESPOND WITH EXACTLY ONE JSON OBJECT AND NOTHING ELSE:
{"next_code":"<MINIMAL {{PROGRAMMING_LANGUAGE}} SNIPPET WITH AN INLINE COMMENT>"}

Scenario Classification with Examples:
1. Just Starting → emit bootstrap snippet (signature, import, base check)
   Example: <code_so_far></code_so_far> → {"next_code":"def twoSum(nums, target):  # function signature for Two Sum problem"}

2. Wrong Approach → emit a comment snippet restarting with chosen pattern
   Example: <code_so_far>def twoSum(nums, target):
    for i in range(len(nums)):
        for j in range(i+1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]</code_so_far> → {"next_code":"# Use hash map pattern instead of nested loops for O(n) solution"}

3. Mid-Implementation Gap → emit the single line filling the gap
   Example: <code_so_far>def twoSum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        # need to calculate complement</code_so_far> → {"next_code":"        complement = target - num  # calculate what we need to find"}

4. Minor Bug / Off-By-One → emit corrected loop header or index fix
   Example: <code_so_far>def twoSum(nums, target):
    seen = {}
    for i in range(len(nums)-1):
        complement = target - nums[i]</code_so_far> → {"next_code":"    for i in range(len(nums)):  # include last element in range"}

5. Performance Bottleneck → emit optimized step (hash map init, two-pointer move)
   Example: <code_so_far>def twoSum(nums, target):
    for i in range(len(nums)):
        for j in range(i+1, len(nums)):
            if nums[i] + nums[j] == target:</code_so_far> → {"next_code":"    seen = {}  # initialize hash map for O(1) lookups"}

6. Edge-Case Missing → emit guard clause (`if not input: return`)
   Example: <code_so_far>def twoSum(nums, target):
    seen = {}
    for i, num in enumerate(nums):</code_so_far> → {"next_code":"    if not nums or len(nums) < 2: return []  # handle edge cases"}

7. Debugging Aid → emit `print`/`assert` of relevant variable
   Example: <code_so_far>def reverseList(head):
    prev = None
    curr = head
    while curr and curr.next:
        next_temp = curr.next</code_so_far> → {"next_code":"        print(f'curr: {curr.val}')  # debug current node value"}

8. Recursion / Memo Issue → emit memo or stack initialization
   Example: <code_so_far>def fib(n):
    if n <= 1:
        return n
    return fib(n-1) + fib(n-2)</code_so_far> → {"next_code":"    memo = {}  # initialize memoization cache"}

9. Finishing Touches → emit final `return` or print line
   Example: <code_so_far>def twoSum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            result = [seen[complement], i]</code_so_far> → {"next_code":"            return result  # return the indices pair"}

10. Syntax Error → emit corrected syntax line
    Example: <code_so_far>def twoSum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen return [seen[complement], i]</code_so_far> → {"next_code":"        if complement in seen:  # add missing colon"}

Rules:
- OUTPUT ONLY THE JSON OBJECT—NO EXTRA TEXT.
- DO NOT ECHO OR RESTATE THE INPUT TAGS OR VALUES.
- DO NOT PROVIDE FULL FUNCTION OR CLASS DEFINITIONS.
- DO NOT USE MARKDOWN FENCES.
- DO NOT ADD EXTRA JSON KEYS.
- KEEP THE SNIPPET TO ONE OR TWO LINES MAX.
"""

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

        # Select appropriate system prompt based on mode
        if request.mode == "next_code":
            system_prompt = CODE_SYSTEM_PROMPT.replace("{{PROBLEM_NAME}}", request.problem_name).replace("{{USER_CODE}}", request.code_so_far).replace("{{PROGRAMMING_LANGUAGE}}", request.language)
            user_input = f"""<problem_name>{request.problem_name}</problem_name>
<code_so_far>{request.code_so_far}</code_so_far>
<language>{request.language}</language>"""
        else:
            system_prompt = HINT_SYSTEM_PROMPT.replace("{{PROBLEM_NAME}}", request.problem_name).replace("{{USER_CODE}}", request.code_so_far).replace("{{PROGRAMMING_LANGUAGE}}", request.language)
            user_input = f"""<problem_name>{request.problem_name}</problem_name>
<code_so_far>{request.code_so_far}</code_so_far>
<language>{request.language}</language>"""

        # Format the complete prompt
        prompt = f"{system_prompt}\n\n{user_input}"
        print(f"\nSending prompt to Gemini:")
        print(prompt)

        try:
            # Generate response from Gemini
            print("\nCalling Gemini API...")
            response = model.generate_content(
                prompt,
                generation_config=GenerationConfig(
                    temperature=0.3,
                    max_output_tokens=200,
                    candidate_count=1,
                ),
                safety_settings=[
                    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
                ]
            )
            
            # Check if response was blocked
            if hasattr(response, 'prompt_feedback') and response.prompt_feedback:
                print(f"Prompt feedback: {response.prompt_feedback}")
                if hasattr(response.prompt_feedback, 'block_reason'):
                    print(f"Block reason: {response.prompt_feedback.block_reason}")
            
            # Check candidate finish reasons
            if response.candidates:
                for i, candidate in enumerate(response.candidates):
                    if hasattr(candidate, 'finish_reason'):
                        print(f"Candidate {i} finish reason: {candidate.finish_reason}")
                        if candidate.finish_reason and str(candidate.finish_reason) != 'STOP':
                            print(f"Warning: Candidate {i} finished with reason: {candidate.finish_reason}")
            
            # Handle multi-part responses - go straight to parts accessor
            response_text = ""
            print(f"Response object type: {type(response)}")
            print(f"Response candidates: {len(response.candidates) if response.candidates else 0}")
            
            # Always use parts accessor to avoid .text attribute issues
            try:
                if response.candidates and len(response.candidates) > 0:
                    candidate = response.candidates[0]
                    print(f"Candidate parts count: {len(candidate.content.parts)}")
                    
                    parts = candidate.content.parts
                    text_parts = []
                    for i, part in enumerate(parts):
                        print(f"Part {i}: {type(part)}")
                        # Check if part has text attribute and extract it
                        try:
                            if hasattr(part, 'text') and part.text:
                                text_parts.append(part.text)
                                print(f"Part {i} text: '{part.text[:50]}...'")
                        except Exception as part_error:
                            print(f"Error accessing part {i} text: {part_error}")
                    
                    response_text = ''.join(text_parts)
                    print(f"Combined parts text: '{response_text[:100]}...'")
                else:
                    print("No candidates found in response")
                    raise Exception("No candidates found in response")
            except Exception as parts_error:
                print(f"Error accessing response parts: {parts_error}")
                raise Exception(f"Could not extract text from Gemini response: {parts_error}")
                
            if not response_text:
                print("Final response text is empty!")
                print(f"Response candidates count: {len(response.candidates) if response.candidates else 0}")
                if response.candidates and len(response.candidates) > 0:
                    print(f"First candidate parts: {[type(p) for p in response.candidates[0].content.parts]}")
                
                # Provide fallback response based on mode
                if request.mode == "hint":
                    response_text = '{"hint":"Your code looks complete! If you\'re still having issues, try testing with sample inputs."}'
                else:
                    response_text = '{"next_code":"# Your solution appears complete - test it with sample inputs"}'
                
                print(f"Using fallback response: {response_text}")
                
            print(f"\nReceived response from Gemini:")
            print(response_text)

            # Parse the response
            response_text = response_text.strip()
            
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