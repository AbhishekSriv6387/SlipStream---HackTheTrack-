/* Seed data for the Slipstream prototype. Edit freely: names, prices, rates and apps all live here. */
window.DATA = {
  oem: { name: 'OEM', car: 'OEM Volt SUV' },
  fleet: 12480,          // vehicles currently sharing at least one signal
  enrolled: 14200,       // vehicles enrolled in the programme
  hoursPerMonth: 45,     // driving hours per month. One demo tick (2.5 s) = one driving hour
  bizPoolPct: 0.2,       // share of every business licence paid to the customers whose data the app runs on
  trackD: 'M60,170 C40,120 70,60 130,55 C190,50 200,100 250,95 C310,88 340,40 365,80 C390,125 340,190 280,195 C230,200 220,160 170,170 C130,178 90,215 60,170 Z',
  hazards: [0.2, 0.55, 0.82],

  // est = what a customer earns per month if they share it (at the default 20% OEM cut)
  // rate = what a developer pays per 1,000 records
  // share = share of the fleet that has switched this signal on
  signals: [
    { id: 'location', name: 'Location', short: 'location', desc: 'Where the car is, blurred to a 1 km grid square. Never your address, home or workplace.', treat: 'Blurred to 1 km cells', est: 90, rate: 18, share: 0.78 },
    { id: 'driving', name: 'Driving behaviour', short: 'driving', desc: 'Braking, acceleration and speed bands. No audio and no camera.', treat: 'Banded values, no raw traces', est: 120, rate: 26, share: 0.84 },
    { id: 'battery', name: 'Battery and energy', short: 'battery', desc: 'State of charge, charging sessions and energy use per trip.', treat: 'Per-trip totals', est: 70, rate: 14, share: 0.91 },
    { id: 'diagnostics', name: 'Fault codes and component health', short: 'diagnostics', desc: 'Warning codes and wear signals from the brakes, coolant, tyres and motor.', treat: 'Code and part only, no VIN', est: 80, rate: 32, share: 0.69 },
    { id: 'trips', name: 'Trips and odometer', short: 'trips', desc: 'Trip length, time of day and total distance. No routes.', treat: 'Rounded time and distance', est: 50, rate: 10, share: 0.73 }
  ],

  // Apps for individual customers (monthly subscription)
  apps: [
    { id: 'ecocoach', name: 'EcoCoach', dev: 'GreenRoute Labs', aud: 'customer', tag: 'The Telemetry Play', price: 299, signals: ['driving', 'battery', 'trips'], desc: 'Scores every trip and coaches smoother driving to stretch your range.', status: 'live', installs: 3120, fees: 41200 },
    { id: 'safelap', name: 'Safe Lap', dev: 'CoverLoop', aud: 'customer', tag: 'The Telemetry Play', price: 449, signals: ['driving', 'location'], desc: 'Turns careful driving into a lower insurance premium, updated every day.', status: 'live', installs: 2480, fees: 36800 },
    { id: 'pitcrew', name: 'PitCrew Predict', dev: 'Torque & Co.', aud: 'customer', tag: 'Zero DNF and The Two-Second Stop', price: 599, signals: ['diagnostics', 'battery'], desc: 'Predicts a failing part before it strands you, then books the repair slot.', status: 'live', installs: 1860, fees: 29400 },
    { id: 'ownerpulse', name: 'OwnerPulse', dev: 'Retain Works', aud: 'customer', tag: 'The Second Stint', price: 249, signals: ['trips', 'diagnostics'], desc: 'Tracks your car\'s value and unlocks loyalty offers on your next car from the same brand.', status: 'live', installs: 940, fees: 11900 },
    { id: 'hazard', name: 'Hazard Radar', dev: 'CityGrid', aud: 'customer', tag: 'The Telemetry Play', price: 149, signals: ['location', 'driving'], desc: 'Warns you about sudden-braking spots reported by other customers ahead.', status: 'live', installs: 5210, fees: 52300 }
  ],

  // Apps licensed by outside businesses (monthly licence per organisation)
  bizApps: [
    { id: 'insurerpro', name: 'Safe Lap Pro', dev: 'CoverLoop', aud: 'business', for: 'Insurers', tag: 'The Telemetry Play', price: 39999, signals: ['driving', 'location'], desc: 'Prices motor insurance from real driving behaviour across a whole portfolio, instead of age and postcode.', status: 'live', installs: 14, fees: 48200 },
    { id: 'fleetservice', name: 'PitCrew Fleet Service', dev: 'Torque & Co.', aud: 'business', for: 'Fleet operators and workshops', tag: 'Zero DNF and The Two-Second Stop', price: 24999, signals: ['diagnostics', 'battery'], desc: 'Predicts which vehicles will fail next and books the workshop bay before they stop.', status: 'live', installs: 38, fees: 61500 },
    { id: 'partpulse', name: 'Part Pulse', dev: 'Supply Signal', aud: 'business', for: 'Parts suppliers', tag: 'The Blind Corner', price: 29999, signals: ['diagnostics'], desc: 'Early warning on component failures by part number and region, built from aggregated fleet data.', status: 'live', installs: 22, fees: 33900 },
    { id: 'dealerloyalty', name: 'Dealer Loyalty Engine', dev: 'Retain Works', aud: 'business', for: 'Dealerships', tag: 'The Second Stint', price: 19999, signals: ['trips', 'diagnostics'], desc: 'Shows which customers are ready for their next car and which offer will win them back.', status: 'live', installs: 31, fees: 18700 },
    { id: 'fleetfuel', name: 'FleetFuel Saver', dev: 'RouteWise', aud: 'business', for: 'Fleet operators', tag: 'The Telemetry Play', price: 14999, signals: ['driving', 'trips', 'location', 'diagnostics'], desc: 'Finds fuel and energy savings across a business fleet.', status: 'pending', installs: 0, fees: 0 }
  ],

  // Data products a developer can request. The last one is a business feed for suppliers.
  failfeed: { id: 'failfeed', name: 'Component failure early-warning feed', short: 'component failures', desc: 'Counts of component faults by part number and region, built for suppliers. Aggregated only.', treat: 'Aggregated, groups of 50+ vehicles', rate: 60, vehicles: 9870, tag: 'The Blind Corner' },

  // Monthly history in thousands of rupees (customer apps and business licences together). The last month is live.
  series: [
    { m: 'Mar', app: 520, data: 110 }, { m: 'Apr', app: 700, data: 150 }, { m: 'May', app: 900, data: 190 },
    { m: 'Jun', app: 1150, data: 235 }, { m: 'Jul', app: 1400, data: 280 }, { m: 'Aug', app: 1700, data: 330 },
    { m: 'Sep', app: 1950, data: 375 }, { m: 'Oct', app: 2200, data: 420 }
  ],

  dealers: ['OEM Service Hub, Zone 4', 'Sunrise Auto Workshop', 'City Motors Express Bay'],
  slots: ['Tomorrow 10:00', 'Tomorrow 14:30', 'Friday 09:15']
};
D_INIT();
function D_INIT() {
  var D = window.DATA;
  D.products = D.signals.map(function (s) { return { id: s.id, name: s.name, short: s.short, desc: s.desc, treat: s.treat, rate: s.rate, share: s.share }; });
  D.products.push(D.failfeed);
}
