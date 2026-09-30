"""
App Evaluation Wrapper
Enables execution via: python -m app.evaluation.backtest
"""
from evaluation.backtest import (
    load_historical_cases,
    run_historical_backtest,
    print_evaluation_report,
    main,
)

__all__ = [
    "load_historical_cases",
    "run_historical_backtest",
    "print_evaluation_report",
    "main",
]

if __name__ == "__main__":
    main()
