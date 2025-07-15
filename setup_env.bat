REM C:\Watch LookUp\setup_env.bat

@echo off
REM Change directory to your project folder
cd /d C:\Watch LookUp

REM Set environment variable for MongoDB URI (replace <your_password> with actual)
setx MONGO_URI "mongodb+srv://texascouty21:lkjbPrV8Mr1iRrev@patek-cluster.rchgesl.mongodb.net/?retryWrites=true&w=majority&appName=patek-cluster"

REM Set environment variable for Netlify CLI (optional, if you use it locally)
REM You can add other env variables here similarly if needed

REM Initialize git repo if not already done
if not exist .git (
    echo Initializing git repo...
    git init
    git add .
    git commit -m "Initial commit"
) else (
    echo Git repo already initialized.
)

REM Install npm dependencies if node_modules folder not exists
if not exist node_modules (
    echo Installing npm dependencies...
    npm install dotenv mongodb csvtojson
) else (
    echo npm packages already installed.
)

echo Environment setup complete. Please restart your terminal or open a new one for variables to take effect.
pause
