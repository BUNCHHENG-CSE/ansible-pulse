import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DEMO_REPOS_DIR = os.path.join(BASE_DIR, "demo_repos")
DEMO_CI_LOGS_DIR = os.path.join(DEMO_REPOS_DIR, "ci_logs")
FRONTEND_DIST_DIR = os.path.join(BASE_DIR, "frontend", "dist")

DEFAULT_DEMO_REPOS = [
    os.path.join(DEMO_REPOS_DIR, "platform-core-infra"),
    os.path.join(DEMO_REPOS_DIR, "ecommerce-frontend"),
    os.path.join(DEMO_REPOS_DIR, "data-pipeline-k8s"),
    os.path.join(DEMO_REPOS_DIR, "payments-gateway"),
]
