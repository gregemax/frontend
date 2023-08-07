import React from 'react'
import { SorobanContextType } from '@soroban-react/core'
import * as SorobanClient from 'soroban-client'
import type { Account, Memo, MemoType, Operation, Transaction } from 'soroban-client';

export type Tx = Transaction<Memo<MemoType>, Operation[]>

export type TransactionStatus = 'idle' | 'error' | 'loading' | 'success'

export class NotImplementedError extends Error { }


export function strToScVal(base64Xdr: string): SorobanClient.xdr.ScVal {
  return SorobanClient.xdr.ScVal.fromXDR(Buffer.from(base64Xdr, 'base64'));
}



export interface contractTransactionProps {
  networkPassphrase: string
  source: SorobanClient.Account
  contractId: string
  method: string
  params?: SorobanClient.xdr.ScVal[]
}

export function contractTransaction({
  networkPassphrase,
  source,
  contractId,
  method,
  params,
}: contractTransactionProps): SorobanClient.Transaction {
  let myParams: SorobanClient.xdr.ScVal[] = params || []

  const contract = new SorobanClient.Contract(contractId)

  return new SorobanClient.TransactionBuilder(source, {
    // TODO: Figure out the fee
    fee: (100).toString(10),
    networkPassphrase,
  })
    .addOperation(contract.call(method, ...myParams))
    .setTimeout(SorobanClient.TimeoutInfinite)
    .build()
}

export interface SendTransactionResult<E = Error> {
  data?: SorobanClient.xdr.ScVal
  error?: E
  isError: boolean
  isIdle: boolean
  isLoading: boolean
  isSuccess: boolean
  sendTransaction: (
    txn?: Tx,
    opts?: SendTransactionOptions
  ) => Promise<SorobanClient.xdr.ScVal>
  reset: () => void
  status: TransactionStatus
}


export interface SendTransactionOptions {
  timeout?: number
  skipAddingFootprint?: boolean
  secretKey?: string
  sorobanContext?: SorobanContextType
}

// useSendTransaction is a hook that returns a function that can be used to
// send a transaction. Upon sending, it will poll server.getTransactionStatus,
// until the transaction succeeds/fails, and return the result.
export function useSendTransaction<E = Error>(
  defaultTxn?: Tx,
  defaultOptions?: SendTransactionOptions
): SendTransactionResult<E> {
  const [status, setState] = React.useState<TransactionStatus>('idle')

  // TODO: as the sorobanContext is passed each time sendTransaction is called
  // we don't need anymore a useCallback hook. Convert useSendTransaction to a
  const sendTransaction = React.useCallback(
    async function (
      passedTxn?: Tx,
      passedOptions?: SendTransactionOptions
    ): Promise<SorobanClient.xdr.ScVal> {

      let sorobanContext: SorobanContextType | undefined = passedOptions?.sorobanContext
      let txn = passedTxn ?? defaultTxn
      
      if (!(passedOptions?.secretKey || sorobanContext?.activeConnector)) {
        throw new Error(
          'No secret key or active wallet. Provide at least one of those'
        )
      }

      if (
        !txn ||
        !sorobanContext?.activeConnector ||
        !sorobanContext?.activeChain
      ) {
        throw new Error('No transaction or wallet or chain')
      }

      if (!sorobanContext.server) throw new Error('Not connected to server')

      let activeChain = sorobanContext?.activeChain
      let activeConnector = sorobanContext?.activeConnector
      let server = sorobanContext?.server

      const { timeout, skipAddingFootprint } = {
        timeout: 60000,
        skipAddingFootprint: false,
        ...defaultOptions,
        ...passedOptions,
      }
      const networkPassphrase = activeChain.networkPassphrase
      setState('loading') 

      const simulated = await server.simulateTransaction(txn)
      console.log("🚀 ~ file: useSendTransaction.tsx:123 ~ simulated:", simulated)
      
      // is it possible for `auths` to be present but empty? Probably not, but let's be safe.
      const auths = simulated.results?.[0]?.auth
      let auth_len =  auths?.length ?? 0;

      if (auth_len > 1) {
        throw new NotImplementedError("Multiple auths not yet supported")
      } else if (auth_len == 1) {
        // TODO: figure out how to fix with new SorobanClient
        // const auth = SorobanClient.xdr.SorobanAuthorizationEntry.fromXDR(auths![0]!, 'base64')
        // if (auth.addressWithNonce() !== undefined) {
        //   throw new NotImplementedError(
        //     `This transaction needs to be signed by ${auth.addressWithNonce()
        //     }; Not yet supported`
        //   )
        // }
      }

     txn = SorobanClient.assembleTransaction(txn, networkPassphrase, simulated) as Tx

      // // preflight and add the footprint
      // if (true) {
      //   txn = await server.prepareTransaction(txn, networkPassphrase)
      //   if (!txn) {
      //     throw new Error('No transaction after adding footprint')
      //   }
      // }
      // console.log("🚀 ~ file: useSendTransaction.tsx:147 ~ txn:", txn)

      let signed;
      if (passedOptions?.secretKey) {
        // User as set a secretKey, txn will be signed using the secretKey
        const keypair = SorobanClient.Keypair.fromSecret(
          passedOptions.secretKey
        )
        txn.sign(keypair)
        signed = txn.toXDR();
        
      } else {
        // User has not set a secretKey, txn will be signed using the Connector (wallet) provided in the sorobanContext
        signed = await activeConnector.signTransaction(txn.toXDR(), {
          networkPassphrase,
        })
      }

      let signedTx: Tx = SorobanClient.TransactionBuilder.fromXDR(
        signed ,
        networkPassphrase
      ) as Tx

      const sendTransactionResponse = await server.sendTransaction(signedTx)
      console.log("🚀 ~ file: useSendTransaction.tsx:175 ~ sendTransactionResponse:", sendTransactionResponse)

      const { hash, errorResultXdr } = sendTransactionResponse

      if (errorResultXdr) {
        setState('error')
        throw new Error(errorResultXdr)
      }
      const sleepTime = Math.min(1000, timeout)
      for (let i = 0; i <= timeout; i += sleepTime) {
        await sleep(sleepTime)
        try {
          console.debug('tx id:', hash)
          const response = await server.getTransaction(hash)
          console.debug(response)

          switch (response.status) {
            case 'NOT_FOUND': {
              continue
            }
            case 'SUCCESS': {
              setState('success')
              let resultXdr = response.resultXdr

              if (!resultXdr) {
                // FIXME: Return a more sensible value for classic transactions.
                return SorobanClient.xdr.ScVal.scvI32(-1)
              }
              let results = SorobanClient.xdr.TransactionResult.fromXDR(
                resultXdr,
                'base64'
              )
                .result()
                .results()
              if (results.length > 1) {
                throw new Error(`Expected exactly one result, got ${results}.`)
              }

              
              let value = results[0].value()
              let valueAll = results[0]
              if (
                value?.switch() !==
                SorobanClient.xdr.OperationType.invokeHostFunction()
              ) {
                // FIXME: Return a more sensible value for classic transactions.
                return SorobanClient.xdr.ScVal.scvI32(-1)
              }

              return SorobanClient.xdr.ScVal.scvI32(-1)
              //return strToScVal(resultXdr)
              //return value.invokeHostFunctionResult().success().buffer
            }
            case 'FAILED': {
              setState('error')
              let resultXdr = response.resultXdr
              if (!resultXdr) {
                // FIXME: Return a more sensible value for classic transactions.
                return SorobanClient.xdr.ScVal.scvI32(-1)
              }
              let results = SorobanClient.xdr.TransactionResult.fromXDR(
                resultXdr,
                'base64'
              )
                .result()
                .results()
              if (results.length > 1) {
                throw new Error(`Expected exactly one result, got ${results}.`)
              }

              let value = results[0].value()
              if (
                value?.switch() !==
                SorobanClient.xdr.OperationType.invokeHostFunction()
              ) {
                // FIXME: Return a more sensible value for classic transactions.
                return SorobanClient.xdr.ScVal.scvI32(-1)
              }

              let result = value.invokeHostFunctionResult()
              switch (result.switch()) {
                case SorobanClient.xdr.InvokeHostFunctionResultCode.invokeHostFunctionMalformed(): {
                  throw new Error('Transaction failed: malformed')
                }
                case SorobanClient.xdr.InvokeHostFunctionResultCode.invokeHostFunctionTrapped(): {
                  throw new Error('Transaction failed: trapped')
                }
                default: {
                  throw new Error(
                    `Unexpected result code: ${result.switch().name}.`
                  )
                }
              }
            }
            default: {
              throw new Error(
                'Unexpected transaction status: ' + response.status
              )
            }
          }
        } catch (err: any) {
          setState('error')
          if ('code' in err && err.code === 404) {
            // No-op
          } else {
            throw err
          }
        }
      }
      throw new Error('Timed out')
    },
    [defaultTxn]
  )

  return {
    isIdle: status == 'idle',
    isError: status == 'error',
    isLoading: status == 'loading',
    isSuccess: status == 'success',
    sendTransaction,
    reset: () => {},
    status,
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
