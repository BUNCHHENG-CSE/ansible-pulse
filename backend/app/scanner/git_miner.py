import os
import subprocess
from datetime import datetime, timezone
from typing import Optional, List, Dict
from ..models.schemas import GitMetadata

class GitMiner:
    @staticmethod
    def get_git_metadata(file_path: str, repo_root: str) -> GitMetadata:
        """Extract commit history, authors, and staleness for a specific file or role."""
        if not os.path.exists(repo_root) or not os.path.exists(os.path.join(repo_root, ".git")):
            # Fall back to filesystem stats if not a git repository
            return GitMiner._fallback_fs_metadata(file_path)

        try:
            rel_path = os.path.relpath(file_path, repo_root)
            
            # 1. Get latest commit info (ISO date, author)
            cmd_last = [
                "git", "-C", repo_root, "log", "-1",
                "--format=%aI|%an", "--", rel_path
            ]
            res_last = subprocess.run(cmd_last, capture_output=True, text=True, check=False)
            
            last_commit_date_str = None
            days_since_last_commit = 0
            if res_last.returncode == 0 and res_last.stdout.strip():
                parts = res_last.stdout.strip().split("|")
                last_commit_date_str = parts[0]
                try:
                    commit_dt = datetime.fromisoformat(last_commit_date_str)
                    now_dt = datetime.now(timezone.utc)
                    days_since_last_commit = max(0, (now_dt - commit_dt).days)
                except Exception:
                    days_since_last_commit = 0

            # 2. Get total commits and all authors
            cmd_authors = [
                "git", "-C", repo_root, "log",
                "--format=%an", "--", rel_path
            ]
            res_authors = subprocess.run(cmd_authors, capture_output=True, text=True, check=False)
            
            authors: List[str] = []
            total_commits = 0
            if res_authors.returncode == 0 and res_authors.stdout.strip():
                raw_authors = [line.strip() for line in res_authors.stdout.splitlines() if line.strip()]
                total_commits = len(raw_authors)
                authors = list(dict.fromkeys(raw_authors))  # preserve order, unique

            # 3. Commits in last 90 days
            cmd_90d = [
                "git", "-C", repo_root, "log", "--since=90.days",
                "--oneline", "--", rel_path
            ]
            res_90d = subprocess.run(cmd_90d, capture_output=True, text=True, check=False)
            commits_last_90d = 0
            if res_90d.returncode == 0 and res_90d.stdout.strip():
                commits_last_90d = len(res_90d.stdout.strip().splitlines())

            # 4. Compute staleness score (0.0 to 1.0)
            # 0 days = 0.0, 90 days = 0.5, 180+ days = 1.0
            if days_since_last_commit <= 14:
                staleness_score = 0.0
            elif days_since_last_commit >= 180:
                staleness_score = 1.0
            else:
                staleness_score = round(days_since_last_commit / 180.0, 2)

            return GitMetadata(
                last_commit_date=last_commit_date_str,
                days_since_last_commit=days_since_last_commit,
                total_commits=total_commits,
                commits_last_90d=commits_last_90d,
                authors=authors,
                author_count=len(authors),
                staleness_score=staleness_score
            )
        except Exception:
            return GitMiner._fallback_fs_metadata(file_path)

    @staticmethod
    def _fallback_fs_metadata(file_path: str) -> GitMetadata:
        if not os.path.exists(file_path):
            return GitMetadata()
        try:
            mtime = os.path.getmtime(file_path)
            dt = datetime.fromtimestamp(mtime, tz=timezone.utc)
            days = max(0, (datetime.now(timezone.utc) - dt).days)
            staleness = min(1.0, round(days / 180.0, 2)) if days > 14 else 0.0
            return GitMetadata(
                last_commit_date=dt.isoformat(),
                days_since_last_commit=days,
                total_commits=1,
                commits_last_90d=1 if days <= 90 else 0,
                authors=["Local File Author"],
                author_count=1,
                staleness_score=staleness
            )
        except Exception:
            return GitMetadata()
