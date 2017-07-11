# Uniquify
###### Unique password generator

## Why is this a thing?
It's annoying to come up with a unique password for every website. You normally have to store them all in a secure database, or just not bother and use the same password for everything which is a security risk.

## What does it do?
This simple chrome extension and webpage let's you use a single master password to generate unique passwords for anything. It always generates the exact same password for the same inputs, so you don't need to store anything. Just remember the master password.

## How does it work?
It takes your master password and the name of a website (or anything really), then passes them through a one-way [Cryptographic Hash Function](https://en.wikipedia.org/wiki/Cryptographic_hash_function) and maps the result onto a generated password.
