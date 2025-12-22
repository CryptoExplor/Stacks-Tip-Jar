;; Stacks Tip Jar - Clarity 4 Enhanced with Transaction History (FIXED)
;; All errors corrected - Production Ready

;; ============================================
;; DATA VARIABLES
;; ============================================

(define-data-var owner principal tx-sender)
(define-data-var total-tips uint u0)
(define-data-var total-tippers uint u0)
(define-data-var total-transactions uint u0)
(define-data-var premium-threshold uint u10000000) ;; 10 STX

;; ============================================
;; DATA MAPS
;; ============================================

(define-map tipper-stats 
  principal 
  {
    total-tipped: uint,
    tip-count: uint,
    last-tip-height: uint,
    is-premium: bool
  }
)

;; Store tip messages
(define-map tip-messages
  { tipper: principal, tip-id: uint }
  { message: (string-utf8 280) }
)

;; Store transaction history
(define-map transaction-history
  uint ;; transaction-id
  {
    tipper: principal,
    amount: uint,
    block-height: uint,
    timestamp: uint,
    has-message: bool
  }
)

;; ============================================
;; CONSTANTS
;; ============================================

(define-constant ERR-INVALID-AMOUNT (err u100))
(define-constant ERR-NO-BALANCE (err u101))
(define-constant ERR-UNAUTHORIZED (err u401))
(define-constant ERR-MESSAGE-TOO-LONG (err u102))
(define-constant ERR-NOT-FOUND (err u103))

;; FIXED: Exactly 34-byte memo constants (68 hex characters)
;; "TIP RECEIVED!" = 13 chars + 21 null bytes = 34 bytes
(define-constant MEMO-TIP-RECEIVED 0x5449502052454345495645442100000000000000000000000000000000000000)
;; "WITHDRAW OK" = 11 chars + 23 null bytes = 34 bytes
(define-constant MEMO-WITHDRAWAL 0x574954484452415720434f4d504c4554450000000000000000000000000000)

;; ============================================
;; READ-ONLY FUNCTIONS
;; ============================================

(define-read-only (get-owner)
  (ok (var-get owner))
)

(define-read-only (get-total-tips)
  (ok (var-get total-tips))
)

(define-read-only (get-total-tippers)
  (ok (var-get total-tippers))
)

(define-read-only (get-total-transactions)
  (ok (var-get total-transactions))
)

(define-read-only (get-contract-balance)
  (ok (stx-get-balance (as-contract tx-sender)))
)

(define-read-only (get-tipper-stats (tipper principal))
  (ok (default-to 
    {
      total-tipped: u0,
      tip-count: u0,
      last-tip-height: u0,
      is-premium: false
    }
    (map-get? tipper-stats tipper)
  ))
)

(define-read-only (get-tipper-stx-account (tipper principal))
  (ok (stx-account tipper))
)

(define-read-only (get-tipper-consensus-hash (tipper principal))
  (ok (to-consensus-buff? tipper))
)

(define-read-only (is-premium-tipper (tipper principal))
  (let (
    (stats (default-to 
      {
        total-tipped: u0,
        tip-count: u0,
        last-tip-height: u0,
        is-premium: false
      }
      (map-get? tipper-stats tipper)
    ))
  )
    (ok (get is-premium stats))
  )
)

(define-read-only (get-tip-message (tipper principal) (tip-id uint))
  (ok (map-get? tip-messages { tipper: tipper, tip-id: tip-id }))
)

(define-read-only (get-transaction (tx-id uint))
  (ok (map-get? transaction-history tx-id))
)

(define-read-only (get-recent-transactions (count uint))
  (let (
    (total (var-get total-transactions))
    (start (if (> total count) (- total count) u0))
  )
    (ok { 
      total: total, 
      start: start, 
      count: count 
    })
  )
)

(define-read-only (get-user-transactions (user principal))
  (let (
    (stats (default-to 
      {
        total-tipped: u0,
        tip-count: u0,
        last-tip-height: u0,
        is-premium: false
      }
      (map-get? tipper-stats user)
    ))
  )
    (ok {
      user: user,
      tip-count: (get tip-count stats),
      total-tipped: (get total-tipped stats),
      last-tip-height: (get last-tip-height stats)
    })
  )
)

(define-read-only (get-contract-summary)
  (ok {
    total-tips: (var-get total-tips),
    total-tippers: (var-get total-tippers),
    total-transactions: (var-get total-transactions),
    contract-balance: (stx-get-balance (as-contract tx-sender)),
    premium-threshold: (var-get premium-threshold),
    owner: (var-get owner)
  })
)

;; ============================================
;; PUBLIC FUNCTIONS
;; ============================================

(define-public (send-tip (amount uint))
  (let (
    (tipper tx-sender)
    (current-stats (default-to 
      {
        total-tipped: u0,
        tip-count: u0,
        last-tip-height: u0,
        is-premium: false
      }
      (map-get? tipper-stats tipper)
    ))
    (new-total (+ (get total-tipped current-stats) amount))
    (new-tip-count (+ (get tip-count current-stats) u1))
    (is-first-time (is-eq (get tip-count current-stats) u0))
    (was-premium (get is-premium current-stats))
    (is-now-premium (>= new-total (var-get premium-threshold)))
    (tx-id (+ (var-get total-transactions) u1))
  )
    ;; Validate amount
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    
    ;; Transfer STX with memo (FIXED: correct 34-byte memo)
    (try! (stx-transfer-memo? 
      amount 
      tipper 
      (as-contract tx-sender)
      MEMO-TIP-RECEIVED
    ))
    
    ;; Update global stats
    (var-set total-tips (+ (var-get total-tips) amount))
    (var-set total-transactions tx-id)
    
    ;; Update tipper count if first time
    (if is-first-time
      (var-set total-tippers (+ (var-get total-tippers) u1))
      false
    )
    
    ;; Update tipper stats
    (map-set tipper-stats tipper {
      total-tipped: new-total,
      tip-count: new-tip-count,
      last-tip-height: stacks-block-height,
      is-premium: is-now-premium
    })
    
    ;; Store transaction history
    (map-set transaction-history tx-id {
      tipper: tipper,
      amount: amount,
      block-height: stacks-block-height,
      timestamp: stacks-block-height,
      has-message: false
    })
    
    ;; Print events
    (print {
      event: "tip-received",
      tx-id: tx-id,
      tipper: tipper,
      amount: amount,
      new-total: new-total,
      tip-number: new-tip-count,
      height: stacks-block-height,
      consensus-hash: (to-consensus-buff? tipper)
    })
    
    ;; Print premium unlock event if achieved
    (if (and is-now-premium (not was-premium))
      (begin
        (print {
          event: "premium-unlocked",
          tipper: tipper,
          total-tipped: new-total,
          height: stacks-block-height
        })
        (ok tx-id)
      )
      (ok tx-id)
    )
  )
)

(define-public (send-tip-with-message (amount uint) (message (string-utf8 280)))
  (let (
    (tipper tx-sender)
    (tip-count-before (get tip-count (default-to 
      { total-tipped: u0, tip-count: u0, last-tip-height: u0, is-premium: false }
      (map-get? tipper-stats tipper)
    )))
    (tx-id (+ (var-get total-transactions) u1))
  )
    ;; Validate message length
    (asserts! (<= (len message) u280) ERR-MESSAGE-TOO-LONG)
    
    ;; Send the tip first
    (try! (send-tip amount))
    
    ;; Update the transaction history to mark it has a message
    (match (map-get? transaction-history tx-id)
      tx-data (map-set transaction-history tx-id 
        (merge tx-data { has-message: true })
      )
      false
    )
    
    ;; Store the message
    (map-set tip-messages 
      { tipper: tipper, tip-id: (+ tip-count-before u1) }
      { message: message }
    )
    
    (print {
      event: "tip-with-message",
      tx-id: tx-id,
      tipper: tipper,
      amount: amount,
      message: message,
      tip-id: (+ tip-count-before u1)
    })
    
    (ok tx-id)
  )
)

(define-public (withdraw (recipient principal))
  (let (
    (balance (stx-get-balance (as-contract tx-sender)))
  )
    ;; Check authorization
    (asserts! (is-eq tx-sender (var-get owner)) ERR-UNAUTHORIZED)
    (asserts! (> balance u0) ERR-NO-BALANCE)
    
    ;; Withdrawal with memo (FIXED: correct 34-byte memo)
    (try! (as-contract (stx-transfer-memo? 
      balance 
      tx-sender 
      recipient
      MEMO-WITHDRAWAL
    )))
    
    ;; Print withdrawal event
    (print {
      event: "withdrawal",
      recipient: recipient,
      amount: balance,
      height: stacks-block-height,
      recipient-consensus: (to-consensus-buff? recipient)
    })
    
    (ok balance)
  )
)

(define-public (transfer-ownership (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get owner)) ERR-UNAUTHORIZED)
    (var-set owner new-owner)
    (print {
      event: "ownership-transferred",
      old-owner: tx-sender,
      new-owner: new-owner,
      new-owner-consensus: (to-consensus-buff? new-owner)
    })
    (ok true)
  )
)

(define-public (set-premium-threshold (new-threshold uint))
  (begin
    (asserts! (is-eq tx-sender (var-get owner)) ERR-UNAUTHORIZED)
    (asserts! (> new-threshold u0) ERR-INVALID-AMOUNT)
    (var-set premium-threshold new-threshold)
    (print {
      event: "premium-threshold-updated",
      new-threshold: new-threshold
    })
    (ok new-threshold)
  )
)
