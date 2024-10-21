# MedHouse KZ Email Processing Backend

## Overview

The MedHouse KZ Email Processing Backend is designed to streamline email management and facilitate file uploads to Google Drive. This application interacts with the frontend to fetch emails, download attachments, and organize them into designated Google Drive folders based on the content of the emails.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)

## Prerequisites

Before running the application, ensure you have the following installed:

- Node.js
- npm (Node Package Manager)
- A compatible web browser

## Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/medhouse-email-processor/backend.git
    cd medhouse-kz-email-backend

## Configuration

2. Create a .env file in the root directory of the project and define the following environment variables:
    ```bash
    DB_NAME=<your_database_name>
    DB_USER=<your_database_user>
    DB_PASS=<your_database_password>
    DB_HOST=<your_database_host>
    GDRIVE_CLIENT_ID=<your_google_drive_client_id>
    GDRIVE_CLIENT_SECRET=<your_google_drive_client_secret>
    GDRIVE_REDIRECT_URI=<your_google_drive_redirect_uri>
    HOST_EMAIL=<your_host_email>
    HOST_PASS=<your_host_imap_password>
    ADMIN_ACCESS_TOKEN=<your_encrypted_admin_access_token>
