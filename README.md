# Hisabi: Receipt Scanner & Manager

Hisabi is a web application that allows users to upload, scan, and manage receipts using OCR powered by the Mindee API. Receipts are parsed for line items and stored in a local SQLite database for easy retrieval and management.

## Features

- **Upload Receipts:** Upload images of receipts and extract line items (name, quantity, price, total) using Mindee’s custom OCR model.
- **View & Save Receipts:** Save parsed receipts with a custom name and view a list of all saved receipts.
- **Receipt Details:** View detailed data for each saved receipt.
- **Simple Web UI:** User-friendly interface built with HTML, CSS, and JavaScript.
- **API Endpoints:** RESTful API for uploading, saving, and retrieving receipts.
- **Local Storage:** Uses SQLite for lightweight, local data storage.

<img width="1693" height="1307" alt="image" src="https://github.com/user-attachments/assets/30e725ea-1dae-471d-93e5-52b1515da063" />


## Tech Stack

- **Backend:** Python, Flask, SQLite, Mindee SDK
- **Frontend:** HTML, CSS, JavaScript (static files)

## Setup & Installation

### 1. Clone the Repository

```bash
git clone https://github.com/ItsAkshatSh/Hisabi.git
cd Hisabi
```

### 2. Install Dependencies

Make sure you have Python 3.7+ installed.

```bash
pip install -r requirements.txt
```

### 3. Set Up Mindee API Key

### 4. Run the Application

```bash
python app.py
```

The app will be available [here](https://gethisabi.vercel.app/).

## Usage

1. **Open the app** in your browser.
2. **Upload a receipt** image (JPG, PNG, etc.).
3. **Review extracted line items** and save the receipt with a custom name.
4. **View all saved receipts** and click to see details.

## Acknowledgements

- [Mindee API](https://www.mindee.com/)
- [Flask](https://flask.palletsprojects.com/)
- [SQLite](https://www.sqlite.org/) 
