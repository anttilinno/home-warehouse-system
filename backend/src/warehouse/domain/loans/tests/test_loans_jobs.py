"""Tests for loan job handlers.

Note: The create_loan_job function is tested via e2e tests in e2e/test_loan_flow.py
which test it against the real database. This avoids complex mocking of async database
sessions and provides better integration coverage.

E2E tests cover:
- test_create_loan_job_direct: Successful loan creation
- test_create_loan_job_invalid_borrower: FK constraint violation for borrower
- test_create_loan_job_invalid_inventory: FK constraint violation for inventory
"""
