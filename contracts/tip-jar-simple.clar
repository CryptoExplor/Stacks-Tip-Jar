;; Stacks Tip Jar Contract V2 - Clarity 4 Enhanced (Simplified & Production Ready)
;; Optimized for Stacks Builder Challenge

;; Contract owner
(define-data-var owner principal tx-sender)

;; Tip tracking
(define-data-var total-tips uint u0)
(define-data-var total-tippers uint u0)
(define-data-var total-transactions uint u0)

;; Track individual tipper stats
(define-map tipper-stats 
  principal 
  {
    total-tipped: uint,
    tip-count: uint,
    last-tip-height: uint,
    is-premium: bool
  }
)

;; Premium threshold (10 STX in micro-STX)
(define-data-var premium-threshold uint u10000000)

;; Event constants
(define-constant EVENT-TIP-RECEIVED "tip-received")
(define-constant EVENT-WITHDRAWAL "withdrawal")
(define-constant EVENT-PREMIUM-UNLOCKED "premium-unlocked")

;; Error codes
(define-constant ERR-INVALID-AMOUNT (err u100))
(define-constant ERR-NO-BALANCE (err u101))
(define-constant ERR-UNAUTHORIZED (err u401))

;; Read-only functions
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

;; Get tipper statistics
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

;; Check if address is premium tipper
(define-read-only (is-premium-tipper (tipper principal))
  (let ((stats (unwrap! (get-tipper-stats tipper) (ok false))))
    (ok (get is-premium stats))
  )
)

;; Get contract statistics summary
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

;; Public functions

;; Send a tip to the contract
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
    (is-first-time (is-eq (get tip-count current-stats) u0))
    (is-now-premium (>= new-total (var-get premium-threshold)))
    (was-premium (get is-premium current-stats))
  )
    ;; Validate amount
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    
    ;; Transfer STX to contract
    (try! (stx-transfer? amount tipper (as-contract tx-sender)))
    
    ;; Update global stats
    (var-set total-tips (+ (var-get total-tips) amount))
    (var-set total-transactions (+ (var-get total-transactions) u1))
    
    ;; Update tipper count if first time
    (if is-first-time
      (var-set total-tippers (+ (var-get total-tippers) u1))
      true
    )
    
    ;; Update tipper stats
    (map-set tipper-stats tipper {
      total-tipped: new-total,
      tip-count: (+ (get tip-count current-stats) u1),
      last-tip-height: stacks-block-height,
      is-premium: is-now-premium
    })
    
    ;; Emit premium event if just achieved (using begin to ensure consistent return type)
    (begin
      (and 
        (and is-now-premium (not was-premium))
        (print {
          event: EVENT-PREMIUM-UNLOCKED,
          tipper: tipper,
          total-tipped: new-total,
          height: stacks-block-height
        })
      )
      true
    )
    
    ;; Emit tip received event
    (print {
      event: EVENT-TIP-RECEIVED,
      tipper: tipper,
      amount: amount,
      new-total: new-total,
      tip-number: (+ (get tip-count current-stats) u1),
      height: stacks-block-height
    })
    
    (ok amount)
  )
)

;; Owner can withdraw all accumulated tips
(define-public (withdraw (recipient principal))
  (let ((balance (stx-get-balance (as-contract tx-sender))))
    (asserts! (is-eq tx-sender (var-get owner)) ERR-UNAUTHORIZED)
    (asserts! (> balance u0) ERR-NO-BALANCE)
    
    ;; Perform withdrawal
    (try! (as-contract (stx-transfer? balance tx-sender recipient)))
    
    ;; Emit withdrawal event
    (print {
      event: EVENT-WITHDRAWAL,
      recipient: recipient,
      amount: balance,
      height: stacks-block-height
    })
    
    (ok balance)
  )
)

;; Owner can transfer ownership
(define-public (transfer-ownership (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get owner)) ERR-UNAUTHORIZED)
    (var-set owner new-owner)
    (ok true)
  )
)

;; Owner can update premium threshold
(define-public (set-premium-threshold (new-threshold uint))
  (begin
    (asserts! (is-eq tx-sender (var-get owner)) ERR-UNAUTHORIZED)
    (asserts! (> new-threshold u0) ERR-INVALID-AMOUNT)
    (var-set premium-threshold new-threshold)
    (ok new-threshold)
  )
)
