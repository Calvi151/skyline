declare module 'midtrans-client' {
  export class Snap {
    constructor(options: {
      isProduction: boolean
      serverKey: string
      clientKey?: string
    })
    createTransaction(parameter: any): Promise<{
      token: string
      redirect_url: string
    }>
    createTransactionToken(parameter: any): Promise<string>
    createTransactionRedirectUrl(parameter: any): Promise<string>
    transaction: {
      notification(notificationJson: any): Promise<any>
      status(transactionId: string): Promise<any>
      approve(transactionId: string): Promise<any>
      cancel(transactionId: string): Promise<any>
      expire(transactionId: string): Promise<any>
      refund(transactionId: string, parameter?: any): Promise<any>
    }
  }

  export class CoreApi {
    constructor(options: {
      isProduction: boolean
      serverKey: string
      clientKey?: string
    })
    charge(parameter: any): Promise<any>
    capture(parameter: any): Promise<any>
    transaction: {
      notification(notificationJson: any): Promise<any>
      status(transactionId: string): Promise<any>
      approve(transactionId: string): Promise<any>
      cancel(transactionId: string): Promise<any>
      expire(transactionId: string): Promise<any>
      refund(transactionId: string, parameter?: any): Promise<any>
    }
  }

  const midtransClient: {
    Snap: typeof Snap
    CoreApi: typeof CoreApi
  }

  export default midtransClient
}

