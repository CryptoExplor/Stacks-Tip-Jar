;; Stacks Tip Jar Contract
;; A simple contract where anyone can send tips and owner can withdraw

(define-data-var owner principal tx-sender)
(define-data-var total-tips uint u0)

;; Read-only functions
(define-read-only (get-owner)
  (ok (var-get owner))
)

(define-read-only (get-total-tips)
  (ok (var-get total-tips))
)

(define-read-only (get-contract-balance)
  (ok (stx-get-balance (as-contract tx-sender)))
)

;; Public functions

;; Send a tip to the contract
(define-public (send-tip (amount uint))
  (begin
    (asserts! (> amount u0) (err u100))
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (var-set total-tips (+ (var-get total-tips) amount))
    (ok amount)
  )
)

;; Owner can withdraw all accumulated tips
(define-public (withdraw (recipient principal))
  (let ((balance (stx-get-balance (as-contract tx-sender))))
    (asserts! (is-eq tx-sender (var-get owner)) (err u401))
    (asserts! (> balance u0) (err u101))
    (try! (as-contract (stx-transfer? balance tx-sender recipient)))
    (ok balance)
  )
)

;; Owner can transfer ownership
(define-public (transfer-ownership (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get owner)) (err u401))
    (var-set owner new-owner)
    (ok true)
  )
)
