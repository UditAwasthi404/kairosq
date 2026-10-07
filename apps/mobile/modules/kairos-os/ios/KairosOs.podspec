Pod::Spec.new do |s|
  s.name           = 'KairosOs'
  s.version        = '1.0.0'
  s.summary        = 'Kairos OS integrations'
  s.description    = 'Share, widget, and keyboard bridges for Kairos'
  s.license        = 'UNLICENSED'
  s.author         = 'Kairos'
  s.homepage       = 'https://github.com/kairos'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
