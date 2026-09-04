# Cars Marketplace workspace

This workspace contains four independent Git repositories: this parent repository
for shared documentation and workspace files, and three application repositories.
Each has its own history, staging area, commits, branches, and remotes.

```text
CarsMarketPlaceProduction/            # Parent repository
├── .git/
├── .gitignore
├── README.md
└── YallaMotorsProduction/
    ├── YallaMotorsApp/               # Flutter application repository
    │   └── .git/
    ├── YallaMotorsAdmin/             # Admin application repository
    │   └── .git/
    ├── YallaMotorsBackend/           # Backend repository
    │   └── .git/
    └── docs/                        # Shared documentation for the parent
```

The parent `.gitignore` excludes all three application directories. A commit or
push in the parent only affects parent files. To save application changes, commit
and push in that application's repository. These are ordinary nested repositories;
cloning the parent requires cloning each application separately as shown below.

Local ZIP archives, Git history backups, downloaded `car-logos-dataset` reference
data, and machine settings are also excluded from the parent repository.

## Repository remotes

| Repository | Origin |
| --- | --- |
| Parent | Not configured yet |
| Flutter app | https://github.com/hussaintt/ArabiyatMart-Flutter.git |
| Admin | Not configured yet |
| Backend | https://github.com/hussaintt/ArabiyatMart-Backend.git |

All four repositories currently use the `main` branch.

## Commit and push separately

Run these commands from the workspace root. Review `git status` and `git diff`
before staging; `add -A` includes every pending change in the selected repository.

```bash
# Flutter app
git -C YallaMotorsProduction/YallaMotorsApp status
git -C YallaMotorsProduction/YallaMotorsApp diff
git -C YallaMotorsProduction/YallaMotorsApp add -A
git -C YallaMotorsProduction/YallaMotorsApp commit -m "Describe the app changes"
git -C YallaMotorsProduction/YallaMotorsApp push -u origin main

# Admin (configure its origin first)
git -C YallaMotorsProduction/YallaMotorsAdmin status
git -C YallaMotorsProduction/YallaMotorsAdmin diff
git -C YallaMotorsProduction/YallaMotorsAdmin add -A
git -C YallaMotorsProduction/YallaMotorsAdmin commit -m "Describe the admin changes"
git -C YallaMotorsProduction/YallaMotorsAdmin push -u origin main

# Backend
git -C YallaMotorsProduction/YallaMotorsBackend status
git -C YallaMotorsProduction/YallaMotorsBackend diff
git -C YallaMotorsProduction/YallaMotorsBackend add -A
git -C YallaMotorsProduction/YallaMotorsBackend commit -m "Describe the backend changes"
git -C YallaMotorsProduction/YallaMotorsBackend push -u origin main

# Parent: shared documentation and workspace files (configure its origin first)
git status
git diff
git add -A
git commit -m "Describe the workspace changes"
git push -u origin main
```

## Connect the parent and admin to remote repositories

Create an empty remote repository for each, then replace the placeholder URLs:

```bash
git remote add origin 'YOUR_PARENT_REPOSITORY_URL'
git push -u origin main

git -C YallaMotorsProduction/YallaMotorsAdmin remote add origin 'YOUR_ADMIN_REPOSITORY_URL'
git -C YallaMotorsProduction/YallaMotorsAdmin push -u origin main
```

Only committed changes are pushed. Application changes that existed before this
workspace was configured remain in their original repositories for review and
separate commits.

## Clone the workspace on another machine

After all four remote repositories are configured and their changes are pushed:

```bash
git clone 'YOUR_PARENT_REPOSITORY_URL' CarsMarketPlaceProduction
cd CarsMarketPlaceProduction
mkdir -p YallaMotorsProduction
git clone https://github.com/hussaintt/ArabiyatMart-Flutter.git YallaMotorsProduction/YallaMotorsApp
git clone 'YOUR_ADMIN_REPOSITORY_URL' YallaMotorsProduction/YallaMotorsAdmin
git clone https://github.com/hussaintt/ArabiyatMart-Backend.git YallaMotorsProduction/YallaMotorsBackend
```
