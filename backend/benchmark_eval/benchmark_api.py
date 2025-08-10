#!/usr/bin/env python3
"""
API Benchmarking Script for SensAI Hint/Code Generation

Usage:
    python benchmark_api.py --num_samples 10 --mode hint
    python benchmark_api.py --num_samples 20 --mode code --use_evaluation
    python benchmark_api.py --num_samples 50 --mode both --endpoint http://localhost:8001/process
    python benchmark_api.py --num_samples 10 --mode hint --use_evaluation --enable_retries
"""

import argparse
import json
import time
import requests
import random
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from statistics import mean, median, stdev

@dataclass
class DetailedMetrics:
    """Detailed evaluation metrics from GPT"""
    technical_accuracy: Optional[float] = None
    pedagogical_value: Optional[float] = None
    clarity_communication: Optional[float] = None
    contextual_relevance: Optional[float] = None
    follows_mode_requirements: Optional[bool] = None
    mode_specific_feedback: Optional[str] = None
    summary_feedback: Optional[str] = None
    improvement_advice: Optional[str] = None

@dataclass
class BenchmarkResult:
    """Individual API call result with detailed metrics"""
    problem_title: str
    mode: str
    response_time: float
    success: bool
    evaluation_score: Optional[float]
    is_good: Optional[bool]
    attempts: int
    error: Optional[str]
    response_length: int
    detailed_metrics: Optional[DetailedMetrics] = None
    pipeline_used: Optional[str] = None

class APIBenchmarker:
    def __init__(self, endpoint: str = "http://localhost:8000/process"):
        self.endpoint = endpoint
        self.results: List[BenchmarkResult] = []
    
    def load_synthetic_data(self, mode: str) -> List[Dict[str, Any]]:
        """Load synthetic data based on mode"""
        if mode == "hint":
            filename = "synthetic_hint_data.jsonl"
        elif mode == "code":
            filename = "synthetic_code_data.jsonl"
        else:
            raise ValueError("Mode must be 'hint' or 'code' for data loading")
        
        try:
            with open(filename, 'r') as f:
                data = [json.loads(line.strip()) for line in f if line.strip()]
            print(f"📁 Loaded {len(data)} samples from {filename}")
            return data
        except FileNotFoundError:
            print(f"❌ Error: {filename} not found!")
            return []
    
    def extract_detailed_metrics(self, response_data: Dict[str, Any]) -> Optional[DetailedMetrics]:
        """Extract detailed metrics from API response"""
        # Try to get evaluation data from various sources
        evaluation_data = None
        
        # Check for evaluation in the response (new detailed_evaluation field first)
        if 'detailed_evaluation' in response_data:
            evaluation_data = response_data['detailed_evaluation']
        elif 'final_evaluation' in response_data:
            evaluation_data = response_data['final_evaluation']
        elif 'evaluation' in response_data:
            evaluation_data = response_data['evaluation']
        
        if not evaluation_data:
            return None
        
        # Extract metrics
        metrics = evaluation_data.get('metrics', {})
        mode_compliance = evaluation_data.get('mode_compliance', {})
        
        return DetailedMetrics(
            technical_accuracy=metrics.get('technical_accuracy'),
            pedagogical_value=metrics.get('pedagogical_value'),
            clarity_communication=metrics.get('clarity_communication'),
            contextual_relevance=metrics.get('contextual_relevance'),
            follows_mode_requirements=mode_compliance.get('follows_mode_requirements'),
            mode_specific_feedback=mode_compliance.get('mode_specific_feedback'),
            summary_feedback=evaluation_data.get('summary_feedback'),
            improvement_advice=evaluation_data.get('improvement_advice')
        )
    
    def make_api_call(self, payload: Dict[str, Any], use_evaluation: bool, enable_retries: bool) -> BenchmarkResult:
        """Make a single API call and measure performance"""
        # Set evaluation and retry settings
        payload['use_evaluation'] = use_evaluation
        
        # Control retry behavior
        if use_evaluation:
            payload['max_retries'] = 2 if enable_retries else 0
        else:
            payload['max_retries'] = 0  # Never retry without evaluation
        
        start_time = time.time()
        
        try:
            response = requests.post(
                self.endpoint,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=30.0
            )
            
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                
                # Extract detailed metrics if available
                detailed_metrics = self.extract_detailed_metrics(data) if use_evaluation else None
                
                return BenchmarkResult(
                    problem_title=payload['problem']['title'],
                    mode=payload['mode'],
                    response_time=response_time,
                    success=True,
                    evaluation_score=data.get('evaluation_score'),
                    is_good=data.get('is_good'),
                    attempts=data.get('attempts', 1),
                    error=None,
                    response_length=len(data.get('response', '')),
                    detailed_metrics=detailed_metrics,
                    pipeline_used=data.get('pipeline', 'Unknown')
                )
            else:
                return BenchmarkResult(
                    problem_title=payload['problem']['title'],
                    mode=payload['mode'],
                    response_time=response_time,
                    success=False,
                    evaluation_score=None,
                    is_good=None,
                    attempts=0,
                    error=f"HTTP {response.status_code}: {response.text}",
                    response_length=0,
                    pipeline_used=None
                )
                
        except requests.RequestException as e:
            response_time = time.time() - start_time
            return BenchmarkResult(
                problem_title=payload['problem']['title'],
                mode=payload['mode'],
                response_time=response_time,
                success=False,
                evaluation_score=None,
                is_good=None,
                attempts=0,
                error=str(e),
                response_length=0,
                pipeline_used=None
            )
    
    def run_benchmark(self, num_samples: int, mode: str, use_evaluation: bool = False, enable_retries: bool = False) -> None:
        """Run benchmark with specified parameters"""
        print(f"\n🚀 Starting benchmark:")
        print(f"   Samples: {num_samples}")
        print(f"   Mode: {mode}")
        print(f"   Evaluation: {'Enabled' if use_evaluation else 'Disabled'}")
        print(f"   Retries: {'Enabled' if enable_retries else 'Disabled'}")
        print(f"   Endpoint: {self.endpoint}")
        
        if use_evaluation:
            retry_setting = "2 retries" if enable_retries else "0 retries"
            print(f"   ⚙️  Retry Setting: {retry_setting} (with evaluation)")
        
        if mode == "both":
            # Run both hint and code modes
            hint_data = self.load_synthetic_data("hint")
            code_data = self.load_synthetic_data("code")
            
            hint_samples = random.sample(hint_data, min(num_samples // 2, len(hint_data)))
            code_samples = random.sample(code_data, min(num_samples // 2, len(code_data)))
            
            all_samples = hint_samples + code_samples
            random.shuffle(all_samples)
        else:
            # Single mode
            data = self.load_synthetic_data(mode)
            all_samples = random.sample(data, min(num_samples, len(data)))
        
        print(f"\n📊 Running {len(all_samples)} API calls...")
        
        for i, sample in enumerate(all_samples, 1):
            print(f"   [{i:3d}/{len(all_samples)}] {sample['problem']['title'][:50]:<50} ({sample['mode']})", end=" ")
            
            result = self.make_api_call(sample, use_evaluation, enable_retries)
            self.results.append(result)
            
            if result.success:
                score_display = f"{result.evaluation_score:.1f}" if result.evaluation_score else "N/A"
                attempts_display = f"({result.attempts} attempts)" if result.attempts > 1 else ""
                print(f"✅ {result.response_time:.2f}s (score: {score_display}) {attempts_display}")
            else:
                print(f"❌ {result.response_time:.2f}s - {result.error}")
    
    def print_results(self) -> None:
        """Print comprehensive benchmark results with detailed metrics"""
        if not self.results:
            print("❌ No results to display")
            return
        
        successful_results = [r for r in self.results if r.success]
        
        print(f"\n{'='*80}")
        print(f"📈 BENCHMARK RESULTS")
        print(f"{'='*80}")
        
        # Overall Statistics
        print(f"\n🎯 OVERALL PERFORMANCE:")
        print(f"   Total Requests: {len(self.results)}")
        print(f"   Successful: {len(successful_results)} ({len(successful_results)/len(self.results)*100:.1f}%)")
        print(f"   Failed: {len(self.results) - len(successful_results)}")
        
        if not successful_results:
            print("❌ No successful requests to analyze")
            return
        
        # Pipeline Usage Analysis
        pipeline_usage = {}
        for result in successful_results:
            pipeline = result.pipeline_used or "Unknown"
            pipeline_usage[pipeline] = pipeline_usage.get(pipeline, 0) + 1
        
        if pipeline_usage:
            print(f"\n🔧 PIPELINE USAGE:")
            for pipeline, count in sorted(pipeline_usage.items(), key=lambda x: x[1], reverse=True):
                percentage = count / len(successful_results) * 100
                print(f"   {pipeline}: {count} ({percentage:.1f}%)")
        
        # Response Time Analysis
        response_times = [r.response_time for r in successful_results]
        print(f"\n⏱️  RESPONSE TIME ANALYSIS:")
        print(f"   Average: {mean(response_times):.2f}s")
        print(f"   Median: {median(response_times):.2f}s")
        print(f"   Min: {min(response_times):.2f}s")
        print(f"   Max: {max(response_times):.2f}s")
        if len(response_times) > 1:
            print(f"   Std Dev: {stdev(response_times):.2f}s")
        
        # Evaluation Score Analysis
        scored_results = [r for r in successful_results if r.evaluation_score is not None]
        if scored_results:
            scores = [r.evaluation_score for r in scored_results]
            retries_needed = [r for r in scored_results if r.evaluation_score < 3.0]
            
            print(f"\n⚖️  EVALUATION SCORE ANALYSIS:")
            print(f"   Evaluated Requests: {len(scored_results)}")
            print(f"   Average Score: {mean(scores):.2f}/5")
            print(f"   Median Score: {median(scores):.2f}/5")
            print(f"   Min Score: {min(scores):.1f}/5")
            print(f"   Max Score: {max(scores):.1f}/5")
            print(f"   Score < 3.0 (Retry Threshold): {len(retries_needed)} ({len(retries_needed)/len(scored_results)*100:.1f}%)")
            
            # Score distribution
            score_bins = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
            for score in scores:
                score_bins[round(score)] += 1
            
            print(f"\n   Score Distribution:")
            for score, count in score_bins.items():
                percentage = count / len(scores) * 100
                bar = "█" * max(1, int(percentage / 2))
                print(f"   {score}/5: {count:3d} ({percentage:5.1f}%) {bar}")
        
        # Detailed Metrics Analysis
        detailed_results = [r for r in successful_results if r.detailed_metrics is not None]
        if detailed_results:
            print(f"\n📊 DETAILED METRICS ANALYSIS:")
            print(f"   Requests with Detailed Metrics: {len(detailed_results)}")
        else:
            print(f"\n📊 DETAILED METRICS ANALYSIS:")
            print(f"   ⚠️  No detailed metrics available. The server doesn't return individual evaluation metrics.")
            print(f"   📝 To enable detailed metrics tracking:")
            print(f"      1. Server needs to include 'detailed_evaluation' field in API response")
            print(f"      2. This should contain the full GPT evaluation with individual metrics")
            print(f"      3. Currently only 'evaluation_score' (overall score) is available")
            print(f"\n   📈 Available Data:")
            print(f"      - Overall evaluation scores: ✅")
            print(f"      - Individual metrics (technical_accuracy, pedagogical_value, etc.): ❌")
            return  # Skip detailed metrics analysis
        
        if detailed_results:
            print(f"\n📊 DETAILED METRICS ANALYSIS:")
            print(f"   Requests with Detailed Metrics: {len(detailed_results)}")
            
            # Core metrics analysis
            metrics_data = {
                'technical_accuracy': [],
                'pedagogical_value': [],
                'clarity_communication': [],
                'contextual_relevance': []
            }
            
            for result in detailed_results:
                metrics = result.detailed_metrics
                if metrics.technical_accuracy is not None:
                    metrics_data['technical_accuracy'].append(metrics.technical_accuracy)
                if metrics.pedagogical_value is not None:
                    metrics_data['pedagogical_value'].append(metrics.pedagogical_value)
                if metrics.clarity_communication is not None:
                    metrics_data['clarity_communication'].append(metrics.clarity_communication)
                if metrics.contextual_relevance is not None:
                    metrics_data['contextual_relevance'].append(metrics.contextual_relevance)
            
            print(f"\n   📋 Individual Metric Statistics:")
            metric_stats = {}
            for metric_name, values in metrics_data.items():
                if values:
                    avg_score = mean(values)
                    min_score = min(values)
                    max_score = max(values)
                    median_score = median(values)
                    std_dev = stdev(values) if len(values) > 1 else 0.0
                    
                    metric_stats[metric_name] = {
                        'avg': avg_score,
                        'min': min_score,
                        'max': max_score,
                        'median': median_score,
                        'std': std_dev,
                        'count': len(values)
                    }
                    
                    formatted_name = metric_name.replace('_', ' ').title()
                    print(f"   {formatted_name}:")
                    print(f"     Average: {avg_score:.2f}/5 | Median: {median_score:.2f}/5")
                    print(f"     Range: {min_score:.1f} - {max_score:.1f} | Std Dev: {std_dev:.2f}")
            
            # Calculate aggregate metrics statistics
            if metric_stats:
                print(f"\n   🎯 Aggregate Metrics Summary:")
                
                # Calculate overall average across all 4 metrics
                all_individual_scores = []
                for values in metrics_data.values():
                    all_individual_scores.extend(values)
                
                if all_individual_scores:
                    overall_individual_avg = mean(all_individual_scores)
                    overall_individual_min = min(all_individual_scores)
                    overall_individual_max = max(all_individual_scores)
                    overall_individual_median = median(all_individual_scores)
                    overall_individual_std = stdev(all_individual_scores) if len(all_individual_scores) > 1 else 0.0
                    
                    print(f"   All Individual Metrics Combined:")
                    print(f"     Average: {overall_individual_avg:.2f}/5 | Median: {overall_individual_median:.2f}/5")
                    print(f"     Range: {overall_individual_min:.1f} - {overall_individual_max:.1f} | Std Dev: {overall_individual_std:.2f}")
                    print(f"     Total Data Points: {len(all_individual_scores)} (across {len(metric_stats)} metrics)")
                
                # Calculate average of metric averages (equal weight per metric type)
                metric_averages = [stats['avg'] for stats in metric_stats.values()]
                if metric_averages:
                    weighted_avg = mean(metric_averages)
                    print(f"   Metric-Weighted Average: {weighted_avg:.2f}/5 (equal weight per metric type)")
                
                # Compare with overall scores from evaluation
                overall_scores = [r.evaluation_score for r in scored_results if r.evaluation_score is not None]
                if overall_scores:
                    overall_score_avg = mean(overall_scores)
                    print(f"   GPT Overall Score Average: {overall_score_avg:.2f}/5")
                    
                    if metric_averages:
                        score_difference = overall_score_avg - weighted_avg
                        print(f"   Difference (Overall - Metric Avg): {score_difference:+.2f}")
                
                # Metric correlation analysis
                if len(metric_stats) >= 2:
                    print(f"\n   📊 Metric Correlations:")
                    metric_names = list(metric_stats.keys())
                    for i, metric1 in enumerate(metric_names):
                        for metric2 in metric_names[i+1:]:
                            values1 = metrics_data[metric1]
                            values2 = metrics_data[metric2]
                            if len(values1) == len(values2) and len(values1) > 1:
                                # Calculate correlation coefficient
                                n = len(values1)
                                sum1 = sum(values1)
                                sum2 = sum(values2)
                                sum1_sq = sum(x*x for x in values1)
                                sum2_sq = sum(x*x for x in values2)
                                sum_products = sum(values1[j] * values2[j] for j in range(n))
                                
                                numerator = n * sum_products - sum1 * sum2
                                denominator = ((n * sum1_sq - sum1**2) * (n * sum2_sq - sum2**2))**0.5
                                
                                if denominator != 0:
                                    correlation = numerator / denominator
                                    print(f"   {metric1.replace('_', ' ').title()} ↔ {metric2.replace('_', ' ').title()}: {correlation:.3f}")
            
            # Performance tier analysis for individual metrics
            if metric_stats:
                print(f"\n   🏆 Performance Tier Breakdown:")
                for metric_name, stats in metric_stats.items():
                    values = metrics_data[metric_name]
                    excellent = len([v for v in values if v >= 4.5])
                    good = len([v for v in values if 3.5 <= v < 4.5])
                    adequate = len([v for v in values if 2.5 <= v < 3.5])
                    poor = len([v for v in values if v < 2.5])
                    
                    formatted_name = metric_name.replace('_', ' ').title()
                    print(f"   {formatted_name}:")
                    print(f"     Excellent (≥4.5): {excellent} ({excellent/len(values)*100:.1f}%)")
                    print(f"     Good (3.5-4.4): {good} ({good/len(values)*100:.1f}%)")
                    print(f"     Adequate (2.5-3.4): {adequate} ({adequate/len(values)*100:.1f}%)")
                    print(f"     Poor (<2.5): {poor} ({poor/len(values)*100:.1f}%)")
            
            # Mode compliance analysis
            mode_compliant = [r for r in detailed_results if r.detailed_metrics.follows_mode_requirements is True]
            mode_non_compliant = [r for r in detailed_results if r.detailed_metrics.follows_mode_requirements is False]
            
            print(f"\n   Mode Compliance:")
            print(f"   Compliant: {len(mode_compliant)} ({len(mode_compliant)/len(detailed_results)*100:.1f}%)")
            print(f"   Non-Compliant: {len(mode_non_compliant)} ({len(mode_non_compliant)/len(detailed_results)*100:.1f}%)")
            
            # Improvement advice analysis
            with_advice = [r for r in detailed_results if r.detailed_metrics.improvement_advice and r.detailed_metrics.improvement_advice != "null"]
            print(f"\n   Improvement Advice Given: {len(with_advice)} ({len(with_advice)/len(detailed_results)*100:.1f}%)")
        
        # Retry Analysis
        retry_results = [r for r in successful_results if r.attempts > 1]
        if retry_results:
            attempts = [r.attempts for r in successful_results]
            print(f"\n🔄 RETRY ANALYSIS:")
            print(f"   Requests with Retries: {len(retry_results)} ({len(retry_results)/len(successful_results)*100:.1f}%)")
            print(f"   Average Attempts: {mean(attempts):.2f}")
            print(f"   Max Attempts: {max(attempts)}")
            
            # Retry effectiveness
            improved_scores = []
            for result in retry_results:
                if result.evaluation_score and result.evaluation_score >= 3.0:
                    improved_scores.append(result)
            
            if improved_scores:
                print(f"   Successful Retries (≥3.0): {len(improved_scores)} ({len(improved_scores)/len(retry_results)*100:.1f}%)")
        
        # Mode-specific Analysis
        modes = set(r.mode for r in successful_results)
        if len(modes) > 1:
            print(f"\n🎭 MODE-SPECIFIC ANALYSIS:")
            for mode in sorted(modes):
                mode_results = [r for r in successful_results if r.mode == mode]
                mode_times = [r.response_time for r in mode_results]
                mode_scores = [r.evaluation_score for r in mode_results if r.evaluation_score is not None]
                mode_retries = [r for r in mode_results if r.attempts > 1]
                
                print(f"   {mode.upper()} Mode ({len(mode_results)} requests):")
                print(f"     Avg Response Time: {mean(mode_times):.2f}s")
                if mode_scores:
                    print(f"     Avg Eval Score: {mean(mode_scores):.2f}/5")
                    poor_scores = len([s for s in mode_scores if s < 3.0])
                    print(f"     Score < 3.0: {poor_scores}/{len(mode_scores)} ({poor_scores/len(mode_scores)*100:.1f}%)")
                print(f"     Retries: {len(mode_retries)} ({len(mode_retries)/len(mode_results)*100:.1f}%)")
        
        # Response Length Analysis
        response_lengths = [r.response_length for r in successful_results]
        print(f"\n📏 RESPONSE LENGTH ANALYSIS:")
        print(f"   Average Length: {mean(response_lengths):.0f} chars")
        print(f"   Median Length: {median(response_lengths):.0f} chars")
        print(f"   Min Length: {min(response_lengths)} chars")
        print(f"   Max Length: {max(response_lengths)} chars")
        
        # Error Analysis
        failed_results = [r for r in self.results if not r.success]
        if failed_results:
            print(f"\n❌ ERROR ANALYSIS:")
            error_types = {}
            for result in failed_results:
                error_key = result.error.split(':')[0] if result.error else "Unknown"
                error_types[error_key] = error_types.get(error_key, 0) + 1
            
            for error, count in sorted(error_types.items(), key=lambda x: x[1], reverse=True):
                print(f"   {error}: {count} occurrences")
        
        # Performance Summary
        print(f"\n🏆 PERFORMANCE SUMMARY:")
        if scored_results:
            excellent = len([r for r in scored_results if r.evaluation_score >= 4.0])
            good = len([r for r in scored_results if 3.0 <= r.evaluation_score < 4.0])
            poor = len([r for r in scored_results if r.evaluation_score < 3.0])
            
            print(f"   Excellent (≥4.0): {excellent} ({excellent/len(scored_results)*100:.1f}%)")
            print(f"   Good (3.0-3.9): {good} ({good/len(scored_results)*100:.1f}%)")
            print(f"   Poor (<3.0): {poor} ({poor/len(scored_results)*100:.1f}%)")
        
        fast_responses = len([r for r in successful_results if r.response_time < 2.0])
        print(f"   Fast (<2s): {fast_responses} ({fast_responses/len(successful_results)*100:.1f}%)")
        
        # Quality vs Speed Analysis
        if scored_results:
            fast_and_good = len([r for r in scored_results if r.response_time < 2.0 and r.evaluation_score >= 4.0])
            print(f"   Fast & Excellent: {fast_and_good} ({fast_and_good/len(scored_results)*100:.1f}%)")
        
        print(f"\n{'='*80}")

def main():
    parser = argparse.ArgumentParser(description='Benchmark the SensAI API with synthetic data')
    parser.add_argument('--num_samples', type=int, required=True,
                        help='Number of samples to test')
    parser.add_argument('--mode', choices=['hint', 'code', 'both'], required=True,
                        help='Test mode: hint, code, or both')
    parser.add_argument('--use_evaluation', action='store_true',
                        help='Enable GPT evaluation (default: False for speed)')
    parser.add_argument('--enable_retries', action='store_true',
                        help='Enable retry mechanism when evaluation is poor (requires --use_evaluation)')
    parser.add_argument('--endpoint', type=str, default='http://localhost:8000/process',
                        help='API endpoint URL (default: http://localhost:8000/process)')
    
    args = parser.parse_args()
    
    # Validate arguments
    if args.num_samples <= 0:
        print("❌ Error: num_samples must be positive")
        return
    
    if args.enable_retries and not args.use_evaluation:
        print("❌ Error: --enable_retries requires --use_evaluation")
        return
    
    # Run benchmark
    benchmarker = APIBenchmarker(args.endpoint)
    
    try:
        benchmarker.run_benchmark(
            num_samples=args.num_samples,
            mode=args.mode,
            use_evaluation=args.use_evaluation,
            enable_retries=args.enable_retries
        )
        benchmarker.print_results()
        
    except KeyboardInterrupt:
        print("\n\n⏹️  Benchmark interrupted by user")
        if benchmarker.results:
            print("Showing partial results...")
            benchmarker.print_results()
    except Exception as e:
        print(f"\n❌ Benchmark failed: {e}")

if __name__ == "__main__":
    main() 