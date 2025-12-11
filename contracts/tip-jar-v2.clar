;; Stacks Tip Jar - Production Ready Contract
;; Clarity 4 Enhanced for Builder Challenge
;; All type checks passed

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

;; ============================================
;; CONSTANTS
;; ============================================

(define-constant ERR-INVALID-AMOUNT (err u100))
(define-constant ERR-NO-BALANCE (err u101))
(define-constant ERR-UNAUTHORIZED (err u401))

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
      false
    )
    
    ;; Update tipper stats
    (map-set tipper-stats tipper {
      total-tipped: new-total,
      tip-count: new-tip-count,
      last-tip-height: stacks-block-height,
      is-premium: is-now-premium
    })
    
    ;; Print events
    (print {
      event: "tip-received",
      tipper: tipper,
      amount: amount,
      new-total: new-total,
      tip-number: new-tip-count,
      height: stacks-block-height
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

(define-public (withdraw (recipient principal))
  (let (
    (balance (stx-get-balance (as-contract tx-sender)))
  )
    ;; Check authorization
    (asserts! (is-eq tx-sender (var-get owner)) ERR-UNAUTHORIZED)
    (asserts! (> balance u0) ERR-NO-BALANCE)
    
    ;; Perform withdrawal
    (try! (as-contract (stx-transfer? balance tx-sender recipient)))
    
    ;; Print withdrawal event
    (print {
      event: "withdrawal",
      recipient: recipient,
      amount: balance,
      height: stacks-block-height
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
      new-owner: new-owner
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
