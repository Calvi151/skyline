export interface ProviderScheduleItem {
  flightNumber: string
  airlineCode: string
  originIata: string
  destinationIata: string
  departureTimeUtc: Date
  arrivalTimeUtc: Date
  durationMinutes: number
  aircraftModel?: string
  externalRef: string
}

export interface ProviderFlightStatus {
  flightNumber: string
  status: 'scheduled' | 'delayed' | 'cancelled'
  delayMinutes: number
  actualDepartureUtc?: Date
  actualArrivalUtc?: Date
}

export interface FlightDataProvider {
  readonly name: string
  getSchedulesByRoute(
    originIata: string,
    destinationIata: string,
    fromDateStr: string, // format YYYY-MM-DD
    toDateStr: string,   // format YYYY-MM-DD
  ): Promise<ProviderScheduleItem[]>

  getFlightStatus(
    flightNumber: string,
    dateStr: string,     // format YYYY-MM-DD
  ): Promise<ProviderFlightStatus | null>
}
