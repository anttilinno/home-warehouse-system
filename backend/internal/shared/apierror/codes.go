package apierror

// ErrorCode is a machine-readable error identifier for frontend translation
type ErrorCode string

// Auth errors (1xxx)
const (
	ErrCodeUnauthorized       ErrorCode = "AUTH_UNAUTHORIZED"        // 1001
	ErrCodeInvalidToken       ErrorCode = "AUTH_INVALID_TOKEN"       // 1002
	ErrCodeTokenExpired       ErrorCode = "AUTH_TOKEN_EXPIRED"       // 1003
	ErrCodeInvalidCredentials ErrorCode = "AUTH_INVALID_CREDENTIALS" // 1004
	ErrCodeSessionExpired     ErrorCode = "AUTH_SESSION_EXPIRED"     // 1005
)

// User errors (2xxx)
const (
	ErrCodeUserNotFound    ErrorCode = "USER_NOT_FOUND"        // 2001
	ErrCodeEmailRequired   ErrorCode = "USER_EMAIL_REQUIRED"   // 2002
	ErrCodeEmailInvalid    ErrorCode = "USER_EMAIL_INVALID"    // 2003
	ErrCodeEmailTaken      ErrorCode = "USER_EMAIL_TAKEN"      // 2004
	ErrCodePasswordInvalid ErrorCode = "USER_PASSWORD_INVALID" // 2005
	ErrCodePasswordTooWeak ErrorCode = "USER_PASSWORD_TOO_WEAK" // 2006
)

// Workspace errors (3xxx)
const (
	ErrCodeWorkspaceNotFound     ErrorCode = "WORKSPACE_NOT_FOUND"              // 3001
	ErrCodeWorkspaceSlugTaken    ErrorCode = "WORKSPACE_SLUG_TAKEN"             // 3002
	ErrCodeWorkspaceAccessDenied ErrorCode = "WORKSPACE_ACCESS_DENIED"          // 3003
	ErrCodeCannotDeletePersonal  ErrorCode = "WORKSPACE_CANNOT_DELETE_PERSONAL" // 3004
)

// Member/Role errors (4xxx)
const (
	ErrCodeMemberNotFound      ErrorCode = "MEMBER_NOT_FOUND"             // 4001
	ErrCodeAlreadyMember       ErrorCode = "MEMBER_ALREADY_EXISTS"        // 4002
	ErrCodeCannotRemoveOwner   ErrorCode = "MEMBER_CANNOT_REMOVE_OWNER"   // 4003
	ErrCodeInsufficientRole    ErrorCode = "MEMBER_INSUFFICIENT_ROLE"     // 4004
	ErrCodeCannotChangeOwnRole ErrorCode = "MEMBER_CANNOT_CHANGE_OWN_ROLE" // 4005
)

// Category errors (5xxx)
const (
	ErrCodeCategoryNotFound    ErrorCode = "CATEGORY_NOT_FOUND"    // 5001
	ErrCodeCategoryCyclic      ErrorCode = "CATEGORY_CYCLIC_REF"   // 5002
	ErrCodeCategoryHasChildren ErrorCode = "CATEGORY_HAS_CHILDREN" // 5003
	ErrCodeCategoryHasItems    ErrorCode = "CATEGORY_HAS_ITEMS"    // 5004
)

// Location errors (6xxx)
const (
	ErrCodeLocationNotFound       ErrorCode = "LOCATION_NOT_FOUND"        // 6001
	ErrCodeLocationShortCodeTaken ErrorCode = "LOCATION_SHORT_CODE_TAKEN" // 6002
	ErrCodeLocationCyclic         ErrorCode = "LOCATION_CYCLIC_REF"       // 6003
	ErrCodeLocationHasContainers  ErrorCode = "LOCATION_HAS_CONTAINERS"   // 6004
	ErrCodeLocationHasInventory   ErrorCode = "LOCATION_HAS_INVENTORY"    // 6005
)

// Container errors (7xxx)
const (
	ErrCodeContainerNotFound       ErrorCode = "CONTAINER_NOT_FOUND"        // 7001
	ErrCodeContainerShortCodeTaken ErrorCode = "CONTAINER_SHORT_CODE_TAKEN" // 7002
	ErrCodeContainerHasInventory   ErrorCode = "CONTAINER_HAS_INVENTORY"    // 7003
)

// Item errors (8xxx)
const (
	ErrCodeItemNotFound       ErrorCode = "ITEM_NOT_FOUND"        // 8001
	ErrCodeItemSKUTaken       ErrorCode = "ITEM_SKU_TAKEN"        // 8002
	ErrCodeItemShortCodeTaken ErrorCode = "ITEM_SHORT_CODE_TAKEN" // 8003
	ErrCodeItemBarcodeTaken   ErrorCode = "ITEM_BARCODE_TAKEN"    // 8004
	ErrCodeItemHasInventory   ErrorCode = "ITEM_HAS_INVENTORY"    // 8005
)

// Inventory errors (9xxx)
const (
	ErrCodeInventoryNotFound         ErrorCode = "INVENTORY_NOT_FOUND"          // 9001
	ErrCodeInventoryInsufficientQty  ErrorCode = "INVENTORY_INSUFFICIENT_QTY"   // 9002
	ErrCodeInventoryInvalidCondition ErrorCode = "INVENTORY_INVALID_CONDITION"  // 9003
	ErrCodeInventoryInvalidStatus    ErrorCode = "INVENTORY_INVALID_STATUS"     // 9004
	ErrCodeInventoryOnLoan           ErrorCode = "INVENTORY_ON_LOAN"            // 9005
	ErrCodeInventoryNotAvailable     ErrorCode = "INVENTORY_NOT_AVAILABLE"      // 9006
)

// Loan errors (10xxx)
const (
	ErrCodeLoanNotFound        ErrorCode = "LOAN_NOT_FOUND"         // 10001
	ErrCodeLoanAlreadyReturned ErrorCode = "LOAN_ALREADY_RETURNED"  // 10002
	ErrCodeLoanQuantityExceeds ErrorCode = "LOAN_QUANTITY_EXCEEDS"  // 10003
	ErrCodeLoanCannotExtend    ErrorCode = "LOAN_CANNOT_EXTEND"     // 10004
)

// Borrower errors (11xxx)
const (
	ErrCodeBorrowerNotFound ErrorCode = "BORROWER_NOT_FOUND"        // 11001
	ErrCodeBorrowerHasLoans ErrorCode = "BORROWER_HAS_ACTIVE_LOANS" // 11002
)

// Company errors (12xxx)
const (
	ErrCodeCompanyNotFound  ErrorCode = "COMPANY_NOT_FOUND"  // 12001
	ErrCodeCompanyNameTaken ErrorCode = "COMPANY_NAME_TAKEN" // 12002
)

// Label errors (13xxx)
const (
	ErrCodeLabelNotFound     ErrorCode = "LABEL_NOT_FOUND"     // 13001
	ErrCodeLabelNameTaken    ErrorCode = "LABEL_NAME_TAKEN"    // 13002
	ErrCodeLabelInvalidColor ErrorCode = "LABEL_INVALID_COLOR" // 13003
)

// Validation errors (90xxx)
const (
	ErrCodeValidationFailed ErrorCode = "VALIDATION_FAILED"        // 90001
	ErrCodeInvalidUUID      ErrorCode = "VALIDATION_INVALID_UUID"  // 90002
	ErrCodeRequiredField    ErrorCode = "VALIDATION_REQUIRED_FIELD" // 90003
	ErrCodeInvalidFormat    ErrorCode = "VALIDATION_INVALID_FORMAT" // 90004
)

// System errors (99xxx)
const (
	ErrCodeInternalError      ErrorCode = "SYSTEM_INTERNAL_ERROR"     // 99001
	ErrCodeDatabaseError      ErrorCode = "SYSTEM_DATABASE_ERROR"     // 99002
	ErrCodeServiceUnavailable ErrorCode = "SYSTEM_SERVICE_UNAVAILABLE" // 99003
)
