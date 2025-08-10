import os
import json
import re
import time
from dotenv import load_dotenv
import openai
from openai import OpenAI
import anthropic
from anthropic import APIStatusError, RateLimitError, APIConnectionError, APITimeoutError
from anthropic.types import TextBlock
from typing import Dict, Optional, Any, Tuple

# Load environment variables
load_dotenv()

class HintGenerator:
    def __init__(self):
        """Initialize the hint generator with Claude client (GPT client initialized on-demand)"""
        
        # Get API keys
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        self.claude_api_key = os.getenv('CLAUDE_API_KEY')
        
        # Claude API key is always required
        if not self.claude_api_key:
            raise ValueError("Please set CLAUDE_API_KEY in .env file")
        
        # Initialize Claude client (required for all operations)
        self.claude_client = anthropic.Anthropic(api_key=self.claude_api_key)
        
        # OpenAI client initialized lazily when evaluation is needed
        self.openai_client = None
        
        # Initialize system prompts
        self._setup_prompts()
    
    def _ensure_openai_client(self):
        """Initialize OpenAI client if not already done and API key is available"""
        if self.openai_client is None:
            if not self.openai_api_key:
                raise ValueError("OPENAI_API_KEY is required for evaluation but not set in .env file")
            self.openai_client = OpenAI(api_key=self.openai_api_key)
    
    def _setup_prompts(self):
        """Initialize system prompts"""
        self.CODE_SYSTEM_PROMPT ="""You are Claude, an expert AI coding assistant with deep knowledge of data structures and algorithms.

Your task is to analyze the user's current code state and provide exactly the next step they need to progress, not a full solution.

You will receive detailed instructions and the user's coding situation. Follow the analysis framework provided and respond with only a JSON object containing the next minimal code snippet.

Return ONLY a single, valid JSON object—no prose."""

        self.HINT_SYSTEM_PROMPT = """You are Claude, a senior engineer mentor who delivers clear, actionable guidance.

Your task is to analyze the user's current code state and provide exactly the next conceptual step they need, not a full solution.

You will receive detailed instructions and the user's coding situation. Follow the analysis framework provided and respond with only a JSON object containing a concise, plain-English hint.

Return ONLY a single, valid JSON object—no prose."""


        self.GPT_EVALUATOR_PROMPT = """You are an expert coding mentor evaluating Claude's response for quality and effectiveness.

EVALUATION FRAMEWORK:
Evaluate each response using 4 core metrics, then apply mode-specific criteria:

=== 4 CORE METRICS (Universal) ===

1. TECHNICAL ACCURACY (1-5)
   - Syntax correctness and logical soundness
   - Appropriate use of algorithms/data structures
   - No bugs or conceptual errors

2. PEDAGOGICAL VALUE (1-5)
   - Helpful for learning progression
   - Appropriately scoped (not too much/little)
   - Builds meaningfully on existing code

3. CLARITY & COMMUNICATION (1-5)
   - Clear, understandable language
   - Proper JSON format compliance
   - Well-structured presentation

4. CONTEXTUAL RELEVANCE (1-5)
   - Addresses user's current state appropriately
   - Logical next step from their code
   - Suitable difficulty progression

=== MODE-SPECIFIC CRITERIA ===
(Mode-specific criteria will be dynamically added based on the evaluation mode)

=== SCORING SCALE ===
5 = EXCELLENT: Exceptional quality, perfect execution of criteria
4 = GOOD: High quality with only minor areas for improvement  
3 = ADEQUATE: Meets basic requirements but has notable room for improvement
2 = POOR: Significant issues that limit effectiveness and learning value
1 = VERY POOR: Incorrect, confusing, or completely unhelpful

=== OUTPUT FORMAT ===
Respond with exactly one JSON object:
{
  "overall_score": 1-5,
  "is_good": true/false,
  "metrics": {
    "technical_accuracy": 1-5,
    "pedagogical_value": 1-5,
    "clarity_communication": 1-5,
    "contextual_relevance": 1-5
  },
  "mode_compliance": {
    "follows_mode_requirements": true/false,
    "mode_specific_feedback": "Brief assessment of mode-specific criteria"
  },
  "summary_feedback": "Concise overall assessment highlighting key strengths and weaknesses",
  "improvement_advice": "Specific actionable advice if overall_score < 3, null otherwise"
}

CRITICAL JSON FORMATTING:
- Keep all text fields to 1-2 sentences maximum
- Escape quotes with \\" and replace newlines with spaces  
- Use null (not "null") for improvement_advice when overall_score >= 3
- Overall score should reflect the average of the 4 metrics with mode compliance consideration"""

    def extract_json_from_response(self, text: str) -> Optional[Dict[str, Any]]:
        """Extract JSON from response with robust parsing and GPT improvement advice handling"""
        txt = text.strip()
        
        # Strip markdown fences
        if txt.startswith("```"):
            txt = re.sub(r"^```(?:json)?\s*|\s*```$", "", txt, flags=re.S)
        
        # Fast path - try direct parsing
        try:
            return json.loads(txt)
        except json.JSONDecodeError:
            pass
        
        # Special handling for GPT evaluation responses with potential improvement_advice issues
        if '"improvement_advice"' in txt:
            # Try to fix common JSON issues in GPT evaluation responses
            fixed_txt = self._fix_gpt_json_issues(txt)
            try:
                return json.loads(fixed_txt)
            except json.JSONDecodeError:
                pass
        
        # Scan for balanced braces
        start = txt.find("{")
        while start != -1:
            depth = 0
            for i in range(start, len(txt)):
                c = txt[i]
                if c == "{": 
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0:
                        cand = txt[start:i+1]
                        try:
                            return json.loads(cand)
                        except json.JSONDecodeError:
                            break
            start = txt.find("{", start + 1)
        
        return None
    
    def _fix_gpt_json_issues(self, text: str) -> str:
        """Fix common JSON formatting issues in GPT evaluation responses"""
        import re
        
        # Common fixes for GPT JSON responses
        fixed = text
        
        # Fix improvement_advice field if it's causing issues
        pattern = r'"improvement_advice":\s*"([^"]*(?:"[^"]*)*)"'
        match = re.search(pattern, fixed, re.DOTALL)
        
        if match:
            advice_content = match.group(1)
            # Remove unescaped quotes and newlines that break JSON
            clean_advice = advice_content.replace('"', '\\"').replace('\n', ' ').replace('\r', ' ')
            # Truncate if too long (common cause of JSON issues)
            if len(clean_advice) > 300:
                clean_advice = clean_advice[:300] + "..."
            fixed = re.sub(pattern, f'"improvement_advice": "{clean_advice}"', fixed, flags=re.DOTALL)
        
        # Fix similar issues with feedback field
        pattern = r'"feedback":\s*"([^"]*(?:"[^"]*)*)"'
        match = re.search(pattern, fixed, re.DOTALL)
        
        if match:
            feedback_content = match.group(1)
            clean_feedback = feedback_content.replace('"', '\\"').replace('\n', ' ').replace('\r', ' ')
            if len(clean_feedback) > 400:
                clean_feedback = clean_feedback[:400] + "..."
            fixed = re.sub(pattern, f'"feedback": "{clean_feedback}"', fixed, flags=re.DOTALL)
        
        # Handle truncated JSON (missing closing brace)
        if not fixed.rstrip().endswith('}'):
            # Count opening and closing braces
            open_braces = fixed.count('{')
            close_braces = fixed.count('}')
            if open_braces > close_braces:
                fixed += '}' * (open_braces - close_braces)
        
        return fixed
    
    def _get_mode_specific_criteria(self, mode: str) -> str:
        """Get mode-specific evaluation criteria based on the mode being evaluated"""
        
        if mode == "hint":
            return """=== HINT MODE CRITERIA ===
- Conceptual guidance without full solution
- Under 25 words
- Suggests approach/pattern, not implementation
- Encourages critical thinking"""
        
        elif mode == "next_code":
            return """=== CODE MODE CRITERIA ===
- Concrete next step (1-3 lines max)
- Builds on existing code structure
- Proper syntax and helpful comments
- Logical progression, not complete solution"""
        
        else:
            return f"=== UNKNOWN MODE: {mode} ===\nEvaluate based on general criteria only."

    def is_valid_schema(self, obj: Dict[str, Any], mode: str) -> Tuple[bool, str]:
        """Strict schema validation with specific error reporting"""
        if not isinstance(obj, dict):
            return False, "Response is not a JSON object"
        
        # Require exactly one key - no extras allowed
        key = "hint" if mode == "hint" else "next_code"
        if set(obj.keys()) != {key}:
            found_keys = list(obj.keys())
            return False, f"Expected exactly '{key}' key, found: {found_keys}"
        
        val = obj[key]
        if not isinstance(val, str):
            return False, f"Value for '{key}' must be a string, got {type(val).__name__}"
        
        if len(val.strip()) < 5:
            return False, f"Value for '{key}' too short ({len(val.strip())} chars), minimum 5 characters"
        
        # Mode-specific validation
        if mode == "next_code":
            lines = [ln for ln in val.splitlines() if ln.strip()]
            if len(lines) > 3:  # Enforce 1-3 lines max (more breathing room)
                return False, f"Code snippet too long ({len(lines)} lines), maximum 3 lines allowed"
            if "```" in val:  # No code fences allowed
                return False, "Code fences (```) not allowed in code snippets"
        
        return True, "Valid schema"

    def generate_without_evaluation(self, problem_name: str, code_so_far: str, language: str = "python", mode: str = "hint") -> Dict[str, Any]:
        """
        Convenience method to generate response with Claude only (no GPT evaluation)
        
        Args:
            problem_name: The coding problem name
            code_so_far: User's current code
            language: Programming language (default: python)
            mode: Either "hint" or "next_code"
        
        Returns:
            Dictionary with Claude response only
        """
        return self.generate_and_evaluate(
            problem_name=problem_name,
            code_so_far=code_so_far,
            language=language,
            mode=mode,
            threshold=3.1,
            max_retries=0,  # No retries since no evaluation
            use_evaluation=False
        )

    def get_claude_response(self, problem_name: str, code_so_far: str, language: str, mode: str, advice: Optional[str] = None) -> Dict[str, Any]:
        """Get response from Claude for either hint or code generation"""
        
        # Select system prompt and create detailed user prompt based on mode
        if mode == "hint":
            system_prompt = self.HINT_SYSTEM_PROMPT
            user_prompt = f"""You are an expert coding mentor.

TASK:
Given the problem name, the user's current code, and the language, identify exactly the next **conceptual** step they should take — not the full solution.

<problem_name>
{problem_name}
</problem_name>

<code_so_far>
{code_so_far}
</code_so_far>

<language>
{language}
</language>

PROCESS:
1. Determine the user's current implementation state from these categories:
   - just_starting
   - wrong_approach
   - mid_gap
   - boundary_issue
   - performance
   - edge_case
   - debug
   - memo_needed
   - finalize_output
   - syntax_fix
2. If a standard algorithmic pattern applies (DFS, DP, BFS, two_pointers, sliding_window, heap, etc.), briefly name it.
3. State **only one** concise, plain-English next step.

OUTPUT:
- One JSON object in the form:
  {{"hint":"<single next step in plain English>"}}

RULES:
- No full solutions.
- No extra keys or formatting.
- No commentary outside JSON.
- Keep the hint under 25 words.
- If the code is empty or unrelated, suggest the starting step.

EXAMPLES:
Input: Problem: "Two Sum", Code: def twoSum(nums, target): pass
Output: {{"hint":"Use a hash map to store complements for O(n) lookup"}}

Input: Problem: "Binary Search", Code: while left <= right:
Output: {{"hint":"Compute mid as (left + right) // 2 before comparisons"}}

Input: Problem: "Valid Parentheses", Code: def isValid(s): stack = []
Output: {{"hint":"Iterate through characters, push opening brackets, pop and check closing ones"}}

AVOID (counterexamples):
❌ {{"hint":"You need to solve this problem"}} - Too vague
❌ {{"hint":"Create a for loop that iterates through the array and checks each element against every other element"}} - Too long and detailed
❌ {{"hint":"Use hash maps", "note":"extra key"}} - Extra keys not allowed"""
            
        elif mode == "next_code":
            system_prompt = self.CODE_SYSTEM_PROMPT
            user_prompt = f"""You are an expert coding mentor.

TASK:
Given the problem name, the user's current code, and the language, output exactly the **next small code snippet** (1–3 lines) they should write to progress.

<problem_name>
{problem_name}
</problem_name>

<code_so_far>
{code_so_far}
</code_so_far>

<language>
{language}
</language>

PROCESS:
1. Identify the user's current progress stage from:
   - just_starting
   - wrong_approach
   - mid_gap
   - minor_bug
   - performance
   - edge_case
   - debug
   - memo_needed
   - finalize_output
   - syntax_fix
2. Internally note if a common algorithmic pattern applies (DFS, DP, BFS, two_pointers, sliding_window, heap, etc.), but do **not** mention it in output.
3. Output only the single most useful next code line(s) in the specified language.

OUTPUT FORMAT:
- One JSON object only:
  {{"next_code":"<minimal {language} snippet with optional inline comment>"}}
- Keep to **1–3 lines** (≤120 characters per line).
- Use only the `{language}` provided.
- Inline comment is optional but encouraged.
- No full function/class definitions.
- No markdown, extra keys, or explanations.

EXAMPLES:
Input: Problem: "Two Sum", Code: def twoSum(nums, target): pass
Output: {{"next_code":"    hashmap = {{}}  # store num:index for O(1) lookup"}}

Input: Problem: "Binary Search", Code: while left <= right:
Output: {{"next_code":"        mid = (left + right) // 2  # midpoint"}}

Input: Problem: "Merge Intervals", Code: # done merging, missing final add
Output: {{"next_code":"    if current_interval: merged.append(current_interval)"}}

AVOID (counterexamples):
❌ {{"next_code":"def solve_problem():\\n    return solution"}} - Too complete, full function
❌ {{"next_code":"# TODO: implement this"}} - No actual code
❌ {{"next_code":"x = 1\\ny = 2\\nz = 3\\nresult = x+y+z"}} - Too many lines (>3)

CONSTRAINTS:
- Think step-by-step internally, but output only the JSON.
- If code is empty or unrelated, start with the most basic setup line."""
            
        else:
            raise ValueError("Mode must be 'hint' or 'next_code'")
        
        # Add improvement advice if provided (for retrial)
        if advice:
            user_prompt += f"\n\n<improvement_advice>\nPrevious attempt was marked as poor. Improvement advice: {advice}\n</improvement_advice>"
        
        # Retry with exponential backoff
        max_attempts = 3
        for attempt in range(max_attempts):
            try:
                response = self.claude_client.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=160,  # Reduced for tighter outputs
                    temperature=0.1,  # Lower for more deterministic
                    timeout=10.0,  # Per-request timeout
                    stop_sequences=["</end>", "---"],  # Prevent extra prose
                    system=system_prompt,
                    messages=[
                        {"role": "user", "content": user_prompt}
                    ]
                )
                break  # Success, exit retry loop
            except (APITimeoutError, RateLimitError, APIConnectionError, APIStatusError) as e:
                if attempt == max_attempts - 1:
                    return {
                        "success": False,
                        "error": f"Claude API error after {max_attempts} attempts: {str(e)}"
                    }
                # Exponential backoff
                time.sleep(2 ** attempt)
                continue
        
        try:
            
            # Robust content extraction - join only TextBlocks
            parts = []
            for blk in response.content:
                if isinstance(blk, TextBlock):
                    parts.append(blk.text)
                elif isinstance(blk, dict) and blk.get("type") == "text":
                    parts.append(blk.get("text", ""))
            
            response_text = "".join(parts).strip()
            if not response_text:
                return {
                    "success": False,
                    "error": "No text blocks in Claude response"
                }
            
            # Log Claude prediction
            print(f"\n🤖 Claude Prediction ({mode}):")
            print(f"   Response: {response_text}")
            
            return {
                "success": True,
                "response": response_text,
                "system_prompt": system_prompt,
                "user_prompt": user_prompt
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def get_gpt_evaluation(self, claude_response: str, problem_name: str, code_so_far: str, mode: str) -> Dict[str, Any]:
        """Get GPT's evaluation of Claude's response with mode-specific criteria"""
        
        # Ensure OpenAI client is initialized (will raise error if API key missing)
        self._ensure_openai_client()
        
        # Add mode-specific criteria to the prompt
        mode_specific_criteria = self._get_mode_specific_criteria(mode)
        
        evaluation_input = {
            "mode_requested": mode,
            "problem_name": problem_name,
            "code_so_far": code_so_far,
            "claude_response": claude_response
        }
        
        prompt = f"{self.GPT_EVALUATOR_PROMPT}\n\n{mode_specific_criteria}\n\nEvaluation Input:\n{json.dumps(evaluation_input, indent=2)}"
        
        max_attempts = 3
        for attempt in range(max_attempts):
            try:
                response = self.openai_client.chat.completions.create(
                    model="gpt-4o-mini",  # Faster and cheaper
                    messages=[
                        {"role": "system", "content": "You are an expert coding mentor. Respond with valid JSON only."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.1,
                    max_tokens=200,  # Increased to prevent JSON truncation
                    timeout=10.0,  # Per-request timeout
                    extra_headers={"X-Title": "HintEval"}  # For tracing
                )
                break  # Success, exit retry loop
            except (openai.APITimeoutError, openai.RateLimitError, openai.APIConnectionError) as e:
                if attempt == max_attempts - 1:
                    return {
                        "success": False,
                        "error": f"OpenAI API error after {max_attempts} attempts: {str(e)}"
                    }
                # Exponential backoff
                time.sleep(2 ** attempt)
                continue
        
        try:
            
            response_text = response.choices[0].message.content.strip()
            
            # Log GPT evaluation
            print(f"\n⚖️ GPT Evaluation:")
            print(f"   Input - Problem: {problem_name}")
            print(f"   Input - Code: {code_so_far[:50]}{'...' if len(code_so_far) > 50 else ''}")
            print(f"   Input - Claude Response: {claude_response[:50]}{'...' if len(claude_response) > 50 else ''}")
            print(f"   GPT Raw Response: {response_text}")
            
            # Parse JSON response with improved handling
            evaluation = self.extract_json_from_response(response_text)
            
            if evaluation:
                # Display overall results
                overall_score = evaluation.get('overall_score', evaluation.get('score', 'N/A'))  # Fallback for old format
                print(f"   📊 Overall Score: {overall_score}/5")
                print(f"   ✅ Is Good: {evaluation.get('is_good', 'N/A')}")
                
                # Display detailed metrics if available
                metrics = evaluation.get('metrics', {})
                if metrics:
                    print(f"   📈 Detailed Metrics:")
                    print(f"      Technical Accuracy: {metrics.get('technical_accuracy', 'N/A')}/5")
                    print(f"      Pedagogical Value: {metrics.get('pedagogical_value', 'N/A')}/5")
                    print(f"      Clarity & Communication: {metrics.get('clarity_communication', 'N/A')}/5")
                    print(f"      Contextual Relevance: {metrics.get('contextual_relevance', 'N/A')}/5")
                
                # Display mode compliance
                mode_compliance = evaluation.get('mode_compliance', {})
                if mode_compliance:
                    follows_reqs = mode_compliance.get('follows_mode_requirements', 'N/A')
                    mode_feedback = mode_compliance.get('mode_specific_feedback', '')
                    print(f"   🎯 Mode Compliance: {follows_reqs}")
                    if mode_feedback:
                        print(f"      {mode_feedback[:80]}{'...' if len(mode_feedback) > 80 else ''}")
                
                # Display summary feedback
                summary = evaluation.get('summary_feedback', evaluation.get('feedback', 'No feedback'))  # Fallback for old format
                print(f"   💬 Summary: {summary[:100]}{'...' if len(summary) > 100 else ''}")
                
                # Show improvement advice if available
                improvement_advice = evaluation.get('improvement_advice')
                if improvement_advice and improvement_advice != "null":
                    print(f"   🔧 Improvement Advice: {improvement_advice[:100]}{'...' if len(improvement_advice) > 100 else ''}")
                
                return {
                    "success": True,
                    "evaluation": evaluation
                }
            else:
                print(f"   ❌ Failed to parse GPT evaluation JSON")
                print(f"   📝 Raw response: {response_text[:300]}...")
                return {
                    "success": False,
                    "error": f"Invalid JSON from GPT: {response_text[:200]}..."
                }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def generate_and_evaluate(self, problem_name: str, code_so_far: str, language: str = "python", mode: str = "hint", threshold: float = 3.0, max_retries: int = 0, use_evaluation: bool = False) -> Dict[str, Any]:
        """
        Generate hint/code with Claude and optionally evaluate with GPT, with optional retrial
        
        Args:
            problem_name: The coding problem name
            code_so_far: User's current code
            language: Programming language (default: python)
            mode: Either "hint" or "next_code"
            threshold: Score threshold below which to retry (default: 3.0)
            max_retries: Maximum number of retries (default: 0)
            use_evaluation: Whether to use GPT evaluation (default: False)
        
        Returns:
            Dictionary with final response and evaluation details
        """
        
        results = {
            "problem_name": problem_name,
            "code_so_far": code_so_far,
            "language": language,
            "mode": mode,
            "attempts": [],
            "final_response": None,
            "final_parsed": None,  # Add parsed JSON result
            "final_evaluation": None,
            "success": False
        }
        
        advice = None
        
        for attempt in range(max_retries + 1):
            # Get Claude response
            claude_result = self.get_claude_response(problem_name, code_so_far, language, mode, advice)
            
            if not claude_result["success"]:
                results["attempts"].append({
                    "attempt": attempt + 1,
                    "claude_result": claude_result,
                    "gpt_evaluation": None,
                    "advice_used": advice
                })
                continue
            
            # Quick local validation first
            response_json = self.extract_json_from_response(claude_result["response"])
            
            if response_json is None:
                # Invalid JSON, skip evaluation and continue to next attempt
                results["attempts"].append({
                    "attempt": attempt + 1,
                    "claude_result": claude_result,
                    "gpt_evaluation": {"success": False, "error": "Invalid JSON"},
                    "advice_used": advice
                })
                advice = "Please ensure your response is valid JSON format"
                continue
            
            # Schema validation
            is_valid, schema_error = self.is_valid_schema(response_json, mode)
            if not is_valid:
                # Failed schema check, skip evaluation and continue
                results["attempts"].append({
                    "attempt": attempt + 1,
                    "claude_result": claude_result,
                    "gpt_evaluation": {"success": False, "error": f"Schema validation failed: {schema_error}"},
                    "advice_used": advice
                })
                advice = f"Schema error: {schema_error}. Please fix your response format."
                continue
            
            # If evaluation is disabled, accept any valid schema response
            if not use_evaluation:
                no_eval_result = {
                    "score": None,
                    "is_good": True,
                    "feedback": "No evaluation - accepted valid schema response"
                }
                
                attempt_data = {
                    "attempt": attempt + 1,
                    "claude_result": claude_result,
                    "gpt_evaluation": {"success": True, "evaluation": no_eval_result},
                    "advice_used": advice
                }
                results["attempts"].append(attempt_data)
                results["final_response"] = claude_result["response"]
                results["final_parsed"] = response_json  # Store parsed JSON
                results["final_evaluation"] = no_eval_result
                results["success"] = True
                break
            
            # Get GPT evaluation
            gpt_result = self.get_gpt_evaluation(
                claude_result["response"], problem_name, code_so_far, mode
            )
            
            attempt_data = {
                "attempt": attempt + 1,
                "claude_result": claude_result,
                "gpt_evaluation": gpt_result,
                "advice_used": advice
            }
            results["attempts"].append(attempt_data)
            
            if not gpt_result["success"]:
                # Record negative evaluation and continue
                advice = "GPT evaluation failed - please ensure valid JSON format"
                continue
            
            evaluation = gpt_result["evaluation"]
            score = evaluation.get("overall_score", evaluation.get("score", 0))  # Handle both old and new format
            is_good = evaluation.get("is_good", False)
            
            if score >= threshold or attempt == max_retries:
                # Either good response or max retries reached
                results["final_response"] = claude_result["response"]
                results["final_parsed"] = response_json  # Store parsed JSON
                results["final_evaluation"] = evaluation
                results["success"] = True
                break
            else:
                # Get improvement advice for next attempt
                advice = evaluation.get("improvement_advice")
        
        return results 