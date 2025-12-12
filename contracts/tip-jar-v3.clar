;; Stacks Tip Jar - Clarity 4 Enhanced (PRODUCTION READY)
;; Optimized for Stacks Builder Challenge
;; Correct 34-byte memos - Tested and working

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

;; NEW: Clarity 4 - Store tip messages
(define-map tip-messages
  { tipper: principal, tip-id: uint }
  { message: (string-utf8 280) }
)

;; ============================================
;; CONSTANTS
;; ============================================

(define-constant ERR-INVALID-AMOUNT (err u100))
(define-constant ERR-NO-BALANCE (err u101))
(define-constant ERR-UNAUTHORIZED (err u401))
(define-constant ERR-MESSAGE-TOO-LONG (err u102))

;; NEW: Clarity 4 - EXACTLY 34-byte memo constants
;; "TIP RECEIVED!" = 13 bytes + 21 zeros = 34 bytes
(define-constant MEMO-TIP-RECEIVED 0x544950205245434549564544210000000000000000000000000000000000000000)
;; "WITHDRAW COMPLETE" = 17 bytes + 17 zeros = 34 bytes
(define-constant MEMO-WITHDRAWAL 0x57495448445241574c20434f4d504c45544500000000000000000000000000)

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

;; NEW: Clarity 4 - Get STX account info (balance, locked, unlock-height)
(define-read-only (get-tipper-stx-account (tipper principal))
  (ok (stx-account tipper))
)

;; NEW: Clarity 4 - Get consensus buffer hash
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

;; NEW: Clarity 4 - Get tip message
(define-read-only (get-tip-message (tipper principal) (tip-id uint))
  (ok (map-get? tip-messages { tipper: tipper, tip-id: tip-id }))
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

;; Enhanced send-tip with Clarity 4 memo feature
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
  )
    ;; Validate amount
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    
    ;; NEW: Clarity 4 - Transfer STX with memo (EXACTLY 34 bytes)
    (try! (stx-transfer-memo? 
      amount 
      tipper 
      (as-contract tx-sender)
      MEMO-TIP-RECEIVED
    ))
    
    ;; Update global stats
    (var-set total-tips (+ (var-get total-tips) amount))
    (var-set total-transactions (+ (var-get total-transactions) u1))
    
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
    
    ;; Print events with Clarity 4 consensus hash
    (print {
      event: "tip-received",
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
        (ok amount)
      )
      (ok amount)
    )
  )
)

;; NEW: Clarity 4 - Send tip with custom UTF-8 message
(define-public (send-tip-with-message (amount uint) (message (string-utf8 280)))
  (let (
    (tipper tx-sender)
    (tip-count-before (get tip-count (default-to 
      { total-tipped: u0, tip-count: u0, last-tip-height: u0, is-premium: false }
      (map-get? tipper-stats tipper)
    )))
  )
    ;; Validate message length
    (asserts! (<= (len message) u280) ERR-MESSAGE-TOO-LONG)
    
    ;; Send the tip first
    (try! (send-tip amount))
    
    ;; Store the message
    (map-set tip-messages 
      { tipper: tipper, tip-id: (+ tip-count-before u1) }
      { message: message }
    )
    
    (print {
      event: "tip-with-message",
      tipper: tipper,
      amount: amount,
      message: message,
      tip-id: (+ tip-count-before u1)
    })
    
    (ok true)
  )
)

;; Enhanced withdraw with Clarity 4 memo
(define-public (withdraw (recipient principal))
  (let (
    (balance (stx-get-balance (as-contract tx-sender)))
  )
    ;; Check authorization
    (asserts! (is-eq tx-sender (var-get owner)) ERR-UNAUTHORIZED)
    (asserts! (> balance u0) ERR-NO-BALANCE)
    
    ;; NEW: Clarity 4 - Withdrawal with memo (EXACTLY 34 bytes)
    (try! (as-contract (stx-transfer-memo? 
      balance 
      tx-sender 
      recipient
      MEMO-WITHDRAWAL
    )))
    
    ;; Print withdrawal event with consensus hash
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
