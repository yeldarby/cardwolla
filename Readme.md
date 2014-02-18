Cardwolla
=========

Cardwolla is a payment router that sits between a merchant and their Credit Card gateway. It melds the ease of
use of a traditional payment card with the low-cost Dwolla network giving merchants and customers the best of
both worlds.

Video Demo
==========

[![demo video](http://img.youtube.com/vi/5K_xvnWxKGk/0.jpg)](http://www.youtube.com/watch?v=5K_xvnWxKGk&feature=youtu.be)

Try It Out (for free)!
======================

Cardwolla is live at [cardwolla.com](https://cardwolla.com). You'll just need a Dwolla account and a payment card.
Then go to [cardwolla.com/example](https://cardwolla.com/example) and give it a try. Don't worry, your card won't
be charged because it uses Stripe's sandbox.

Dwolla payments are currently being sent to the Dwolla "reflector" so they will be sent right back to your account.

Security
========

Cardwolla never stores your credit card number. I've tried my hardest to create a secure hash but I know there is always room for improvement when it comes to security. If you'd like to suggest a better way to do a one-way hash of a credit card number (while keeping it indexable) I'd love to hear from you!

Currently we are using SHA512 with a shared salt 100 times.

Feature Backlog
===============

 - Suggestions? Send our developer a tweet [@braddwyer](http://www.twitter.com/braddwyer).

About this Project
==================

This project was created for PennApps Winter 2014 by Yeldarb LLC. All rights reserved.
