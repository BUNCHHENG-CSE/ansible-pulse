import os
import shutil
import subprocess
from datetime import datetime, timedelta, timezone

DEMO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "demo_repos"))

def run_git(cwd, args, env_vars=None):
    env = os.environ.copy()
    if env_vars:
        env.update(env_vars)
    subprocess.run(["git"] + args, cwd=cwd, check=True, env=env, capture_output=True, text=True)

def create_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def setup_demo():
    if os.path.exists(DEMO_ROOT):
        shutil.rmtree(DEMO_ROOT)
    os.makedirs(DEMO_ROOT, exist_ok=True)

    now = datetime.now(timezone.utc)

    # ==========================================
    # 1. REPO: platform-core-infra
    # Contains: common_base (Zombie Core!) & nginx_edge
    # ==========================================
    repo1 = os.path.join(DEMO_ROOT, "platform-core-infra")
    os.makedirs(repo1, exist_ok=True)
    run_git(repo1, ["init"])
    run_git(repo1, ["config", "user.name", "Alex Senior Architect"])
    run_git(repo1, ["config", "user.email", "alex.senior@infra.corp"])

    # roles/common_base/tasks/main.yml
    common_base_tasks = """---
# Central Security Hardening and Base Host Configuration
- name: Apply core kernel sysctl parameters
  ansible.builtin.sysctl:
    name: "{{ item.key }}"
    value: "{{ item.value }}"
    state: present
    reload: yes
  loop:
    - { key: "net.ipv4.ip_forward", value: "0" }
    - { key: "fs.file-max", value: "65535" }
    - { key: "vm.swappiness", value: "10" }
  tags: [security, sysctl]

- name: Install mandatory system packages
  ansible.builtin.apt:
    name:
      - curl
      - git
      - vim
      - htop
      - ufw
    state: present
    update_cache: yes
  tags: [base_pkgs]

- name: Ensure standard deploy user exists
  ansible.builtin.user:
    name: deploy
    shell: /bin/bash
    groups: sudo
    append: yes
    state: present
  tags: [users, security]

- name: Configure NTP chrony service
  ansible.builtin.service:
    name: chrony
    state: started
    enabled: yes
"""
    create_file(os.path.join(repo1, "roles", "common_base", "tasks", "main.yml"), common_base_tasks)

    # roles/nginx_edge/tasks/main.yml
    nginx_edge_tasks = """---
- name: Install Nginx Web Server
  ansible.builtin.apt:
    name: nginx
    state: present
    update_cache: yes
  tags: [web, nginx]

- name: Ensure Nginx is running and enabled
  ansible.builtin.service:
    name: nginx
    state: started
    enabled: yes
  tags: [web, nginx]

- name: Deploy core SSL configuration template
  ansible.builtin.template:
    src: ssl.conf.j2
    dest: /etc/nginx/conf.d/ssl.conf
    mode: "0644"
  notify: reload nginx
"""
    create_file(os.path.join(repo1, "roles", "nginx_edge", "tasks", "main.yml"), nginx_edge_tasks)

    # playbooks/site_core.yml
    site_core = """---
- name: Bootstrap Base Infrastructure Fleet
  hosts: all_servers
  become: yes
  roles:
    - common_base
    - nginx_edge
"""
    create_file(os.path.join(repo1, "playbooks", "site_core.yml"), site_core)

    # Commit with date 420 days ago (ZOMBIE CORE TRIGGER)
    old_date = (now - timedelta(days=420)).isoformat()
    run_git(repo1, ["add", "."])
    run_git(repo1, ["commit", "-m", "feat: initial commit for enterprise base hardening role"],
            env_vars={"GIT_AUTHOR_DATE": old_date, "GIT_COMMITTER_DATE": old_date})

    # ==========================================
    # 2. REPO: ecommerce-frontend
    # Contains: deploy_web.yml, docker_setup (duplicate 1), nginx_proxy (duplicate 1)
    # ==========================================
    repo2 = os.path.join(DEMO_ROOT, "ecommerce-frontend")
    os.makedirs(repo2, exist_ok=True)
    run_git(repo2, ["init"])
    run_git(repo2, ["config", "user.name", "Sarah Frontend SRE"])
    run_git(repo2, ["config", "user.email", "sarah.sre@ecommerce.corp"])

    docker_setup_ecommerce = """---
# Docker installation for web worker nodes
- name: Install Docker CE container runtime
  ansible.builtin.apt:
    name:
      - docker-ce
      - docker-ce-cli
      - containerd.io
    state: present
    update_cache: yes
  tags: [docker, containers]

- name: Ensure Docker daemon service is started
  ansible.builtin.service:
    name: docker
    state: started
    enabled: yes
  tags: [docker]

- name: Configure Docker daemon json
  ansible.builtin.copy:
    dest: /etc/docker/daemon.json
    content: |
      {
        "log-driver": "json-file",
        "log-opts": {"max-size": "100m", "max-file": "3"}
      }
    mode: "0644"
"""
    create_file(os.path.join(repo2, "tasks", "docker_setup.yml"), docker_setup_ecommerce)

    nginx_ecommerce = """---
- name: Install Nginx Web Server
  ansible.builtin.apt:
    name: nginx
    state: latest
    update_cache: no
  tags: [web, proxy]

- name: Ensure Nginx is running and enabled
  ansible.builtin.service:
    name: nginx
    state: started
    enabled: yes

- name: Deploy frontend reverse proxy template
  ansible.builtin.template:
    src: frontend_proxy.conf.j2
    dest: /etc/nginx/conf.d/frontend.conf
    mode: "0644"
"""
    create_file(os.path.join(repo2, "tasks", "nginx_proxy.yml"), nginx_ecommerce)

    deploy_web = """---
- name: Deploy E-Commerce Frontend Clusters
  hosts: web_nodes
  become: yes
  roles:
    - common_base
  tasks:
    - name: Setup container runtime
      ansible.builtin.include_tasks: tasks/docker_setup.yml

    - name: Configure reverse proxy
      ansible.builtin.include_tasks: tasks/nginx_proxy.yml
"""
    create_file(os.path.join(repo2, "playbooks", "deploy_web.yml"), deploy_web)

    recent_date1 = (now - timedelta(days=12)).isoformat()
    run_git(repo2, ["add", "."])
    run_git(repo2, ["commit", "-m", "deploy: update nginx proxy headers and docker config"],
            env_vars={"GIT_AUTHOR_DATE": recent_date1, "GIT_COMMITTER_DATE": recent_date1})

    # ==========================================
    # 3. REPO: data-pipeline-k8s
    # Contains: setup_spark_worker.yml, install_docker (duplicate 2 via curl shell!)
    # ==========================================
    repo3 = os.path.join(DEMO_ROOT, "data-pipeline-k8s")
    os.makedirs(repo3, exist_ok=True)
    run_git(repo3, ["init"])
    run_git(repo3, ["config", "user.name", "Dave Data Eng"])
    run_git(repo3, ["config", "user.email", "dave.de@datapipeline.corp"])

    docker_curl_pipeline = """---
# Docker setup via convenience shell script
- name: Install Docker CE container runtime
  ansible.builtin.shell: curl -fsSL https://get.docker.com | sh
  args:
    creates: /usr/bin/docker
  tags: [docker, data]

- name: Ensure Docker daemon service is started
  ansible.builtin.service:
    name: docker
    state: started
    enabled: yes
"""
    create_file(os.path.join(repo3, "tasks", "install_docker.yml"), docker_curl_pipeline)

    spark_worker = """---
- name: Provision High-Throughput Spark Worker Nodes
  hosts: spark_workers
  become: yes
  roles:
    - common_base
  tasks:
    - name: Install Docker for containerized jobs
      ansible.builtin.include_tasks: tasks/install_docker.yml
"""
    create_file(os.path.join(repo3, "playbooks", "setup_spark_worker.yml"), spark_worker)

    recent_date2 = (now - timedelta(days=45)).isoformat()
    run_git(repo3, ["add", "."])
    run_git(repo3, ["commit", "-m", "feat: spark worker pipeline bootstrap playbook"],
            env_vars={"GIT_AUTHOR_DATE": recent_date2, "GIT_COMMITTER_DATE": recent_date2})

    # ==========================================
    # 4. REPO: payments-gateway
    # Contains: production_pci_cluster.yml, docker_engine (duplicate 3 with pinned old version!)
    # ==========================================
    repo4 = os.path.join(DEMO_ROOT, "payments-gateway")
    os.makedirs(repo4, exist_ok=True)
    run_git(repo4, ["init"])
    run_git(repo4, ["config", "user.name", "Marcus SecOps"])
    run_git(repo4, ["config", "user.email", "marcus.sec@fintech.corp"])

    docker_pci = """---
# PCI-DSS strict pinned container runtime
- name: Install Docker CE container runtime
  ansible.builtin.apt:
    name:
      - docker-ce=5:23.0.1-1~ubuntu.22.04~jammy
      - docker-ce-cli=5:23.0.1-1~ubuntu.22.04~jammy
    state: present
    update_cache: yes
    allow_downgrades: yes
  tags: [docker, pci_strict]

- name: Ensure Docker daemon service is started
  ansible.builtin.service:
    name: docker
    state: started
    enabled: yes
"""
    create_file(os.path.join(repo4, "tasks", "docker_engine.yml"), docker_pci)

    user_mgmt = """---
- name: Ensure standard deploy user exists
  ansible.builtin.user:
    name: deploy
    shell: /bin/bash
    groups: sudo
    append: yes
    state: present
"""
    create_file(os.path.join(repo4, "tasks", "user_mgmt.yml"), user_mgmt)

    pci_playbook = """---
- name: Provision PCI-DSS Compliant Payment Cluster
  hosts: payment_clusters
  become: yes
  roles:
    - common_base
  tasks:
    - name: Enforce user management
      ansible.builtin.include_tasks: tasks/user_mgmt.yml

    - name: Install pinned container engine
      ansible.builtin.include_tasks: tasks/docker_engine.yml
"""
    create_file(os.path.join(repo4, "playbooks", "production_pci_cluster.yml"), pci_playbook)

    recent_date3 = (now - timedelta(days=25)).isoformat()
    run_git(repo4, ["add", "."])
    run_git(repo4, ["commit", "-m", "sec: pin docker engine to audited version 23.0.1"],
            env_vars={"GIT_AUTHOR_DATE": recent_date3, "GIT_COMMITTER_DATE": recent_date3})

    # ==========================================
    # 5. CI EXECUTION LOGS
    # ==========================================
    ci_dir = os.path.join(DEMO_ROOT, "ci_logs")
    os.makedirs(ci_dir, exist_ok=True)

    ci_runs_json = [
        {
            "playbook": "playbooks/deploy_web.yml",
            "repo": "ecommerce-frontend",
            "timestamp": (now - timedelta(hours=2)).isoformat(),
            "status": "success",
            "environment": "production",
            "hosts": ["web-prod-01", "web-prod-02", "web-prod-03"],
            "tasks_ok": 18,
            "tasks_changed": 2,
            "tasks_failed": 0
        },
        {
            "playbook": "playbooks/setup_spark_worker.yml",
            "repo": "data-pipeline-k8s",
            "timestamp": (now - timedelta(hours=14)).isoformat(),
            "status": "changed",
            "environment": "staging",
            "hosts": ["spark-worker-stage-01", "spark-worker-stage-02"],
            "tasks_ok": 12,
            "tasks_changed": 4,
            "tasks_failed": 0
        },
        {
            "playbook": "playbooks/production_pci_cluster.yml",
            "repo": "payments-gateway",
            "timestamp": (now - timedelta(days=1)).isoformat(),
            "status": "failed",
            "environment": "production",
            "hosts": ["pci-gateway-node-01"],
            "tasks_ok": 6,
            "tasks_changed": 0,
            "tasks_failed": 1,
            "error": "sysctl net.ipv4.ip_forward: permission denied in unmaintained common_base"
        },
        {
            "playbook": "playbooks/site_core.yml",
            "repo": "platform-core-infra",
            "timestamp": (now - timedelta(days=140)).isoformat(),
            "status": "success",
            "environment": "staging",
            "hosts": ["bastion-01"],
            "tasks_ok": 10,
            "tasks_changed": 0,
            "tasks_failed": 0
        }
    ]

    import json
    with open(os.path.join(ci_dir, "ci_pipeline_runs.json"), "w", encoding="utf-8") as f:
        json.dump(ci_runs_json, f, indent=2)

    print("Demo repositories successfully generated at:", DEMO_ROOT)

if __name__ == "__main__":
    setup_demo()
