# SensAI Benchmark Tool



LAST TEST : 08/09/25 : python benchmark_api.py --num_samples 20 --mode both --use_evaluation --enable_retries

🎯 Aggregate Metrics Summary:
   All Individual Metrics Combined:
     Average: 4.20/5 | Median: 4.00/5
     Range: 2.0 - 5.0 | Std Dev: 0.66
     Total Data Points: 80 (across 4 metrics)
   Metric-Weighted Average: 4.20/5 (equal weight per metric type)
   GPT Overall Score Average: 3.95/5
   Difference (Overall - Metric Avg): -0.25

   📊 Metric Correlations:
   Technical Accuracy ↔ Pedagogical Value: 0.577
   Technical Accuracy ↔ Clarity Communication: 0.372
   Technical Accuracy ↔ Contextual Relevance: 0.247
   Pedagogical Value ↔ Clarity Communication: 0.721
   Pedagogical Value ↔ Contextual Relevance: 0.795
   Clarity Communication ↔ Contextual Relevance: 0.480

   🏆 Performance Tier Breakdown:
   Technical Accuracy:
     Excellent (≥4.5): 13 (65.0%)
     Good (3.5-4.4): 6 (30.0%)
     Adequate (2.5-3.4): 1 (5.0%)
     Poor (<2.5): 0 (0.0%)
   Pedagogical Value:
     Excellent (≥4.5): 2 (10.0%)
     Good (3.5-4.4): 15 (75.0%)
     Adequate (2.5-3.4): 2 (10.0%)
     Poor (<2.5): 1 (5.0%)
   Clarity Communication:
     Excellent (≥4.5): 6 (30.0%)
     Good (3.5-4.4): 12 (60.0%)
     Adequate (2.5-3.4): 2 (10.0%)
     Poor (<2.5): 0 (0.0%)
   Contextual Relevance:
     Excellent (≥4.5): 5 (25.0%)
     Good (3.5-4.4): 12 (60.0%)
     Adequate (2.5-3.4): 3 (15.0%)
     Poor (<2.5): 0 (0.0%)

   Mode Compliance:
   Compliant: 19 (95.0%)
   Non-Compliant: 1 (5.0%)

   Improvement Advice Given: 3 (15.0%)

A comprehensive benchmarking tool for the SensAI hint/code generation API with detailed metrics tracking and retry control.

## Features

### 🎯 **Core Functionality**
- **Multiple Modes**: Test hint generation, code generation, or both
- **Synthetic Data**: Uses curated JSONL datasets for consistent testing
- **Performance Metrics**: Response time, success rate, and throughput analysis
- **Quality Evaluation**: GPT-based evaluation with detailed scoring

### 📊 **New Detailed Metrics Tracking**
- **Core Evaluation Metrics**:
  - Technical Accuracy (1-5)
  - Pedagogical Value (1-5) 
  - Clarity & Communication (1-5)
  - Contextual Relevance (1-5)
- **Mode Compliance**: Tracks adherence to hint/code generation requirements
- **Improvement Advice**: Captures GPT's suggestions for low-scoring responses
- **Pipeline Usage**: Tracks whether "Claude only" or "Claude + GPT" was used

### 🔄 **Retry Control**
- **Enable/Disable Retries**: Control whether poor responses trigger retries
- **Retry Effectiveness**: Tracks success rate of retry mechanisms
- **Configurable Thresholds**: Server uses 3.0/5 threshold for retry triggers
- **Attempt Tracking**: Shows how many attempts were needed for each request

## Usage

### Basic Examples

```bash
# Fast testing - Claude only (no evaluation, no retries)
python benchmark_api.py --num_samples 10 --mode hint

# Quality testing - Claude + GPT evaluation (no retries)
python benchmark_api.py --num_samples 10 --mode code --use_evaluation

# Full testing - Claude + GPT evaluation with retries enabled
python benchmark_api.py --num_samples 10 --mode hint --use_evaluation --enable_retries

# Mixed mode testing
python benchmark_api.py --num_samples 20 --mode both --use_evaluation --enable_retries
```

### Advanced Options

```bash
# Custom endpoint
python benchmark_api.py --num_samples 10 --mode hint --endpoint http://localhost:8001/process

# Large scale testing
python benchmark_api.py --num_samples 100 --mode both --use_evaluation
```

## Output Sections

### 📈 **Performance Analysis**
- Overall success/failure rates
- Response time statistics (avg, median, min, max, std dev)
- Pipeline usage breakdown

### ⚖️ **Evaluation Metrics**
- Overall scores (1-5 scale)
- Score distribution histogram
- Retry threshold analysis (scores < 3.0)

### 📊 **Detailed Metrics** (New!)
- Individual metric averages:
  - Technical Accuracy
  - Pedagogical Value  
  - Clarity & Communication
  - Contextual Relevance
- Mode compliance rates
- Improvement advice frequency

### 🔄 **Retry Analysis** (New!)
- Retry frequency and success rates
- Average attempts per request
- Retry effectiveness (final scores ≥ 3.0)

### 🎭 **Mode-Specific Analysis**
- Separate stats for hint vs code generation
- Mode-specific performance comparisons
- Response time and quality by mode

### 🏆 **Performance Summary**
- Quality tiers (Excellent ≥4.0, Good 3.0-3.9, Poor <3.0)
- Speed analysis (Fast <2s responses)
- Combined quality + speed metrics

## Retry Control Details

### How Retry Control Works
1. **With `--enable_retries`**: Server uses `max_retries=2` when evaluation enabled
2. **Without `--enable_retries`**: Server uses `max_retries=0` (no retries)
3. **No Evaluation**: Always `max_retries=0` regardless of retry flag

### Retry Mechanism
- **Trigger**: GPT evaluation score < 3.0/5
- **Max Attempts**: 3 total (1 initial + 2 retries)
- **Improvement Advice**: GPT provides specific feedback for retry attempts
- **Threshold**: Accepts any response ≥ 3.0 or after max attempts

## Data Sources

- **`synthetic_hint_data.jsonl`**: 66 hint generation scenarios
- **`synthetic_code_data.jsonl`**: 66 code generation scenarios
- **Mixed Mode**: Randomly samples from both datasets

## Performance Benchmarks

### Typical Performance (Claude 3.5 Sonnet + GPT-4o-mini)
- **Claude Only**: ~1.2s average response time
- **Claude + GPT Evaluation**: ~3.5-4.5s average response time
- **Success Rate**: >95% for well-formed requests
- **Quality Scores**: Typically 4.0-5.0/5 (excellent quality)
- **Retry Rate**: <5% (Claude generates high-quality responses)

### Example Output Stats
```
🎯 OVERALL PERFORMANCE:
   Total Requests: 50
   Successful: 50 (100.0%)
   
⚖️ EVALUATION SCORE ANALYSIS:
   Average Score: 4.2/5
   Score < 3.0 (Retry Threshold): 2 (4.0%)
   
📊 DETAILED METRICS ANALYSIS:
   Technical Accuracy: 4.3/5
   Pedagogical Value: 4.1/5
   Clarity & Communication: 4.4/5
   Contextual Relevance: 4.2/5
   Mode Compliance: 98.0%
   
🔄 RETRY ANALYSIS:
   Requests with Retries: 2 (4.0%)
   Successful Retries (≥3.0): 2 (100.0%)
```

## Requirements

- Python 3.7+
- `requests` library
- Access to SensAI API endpoint (default: `http://localhost:8000/process`)
- Synthetic data files in same directory 