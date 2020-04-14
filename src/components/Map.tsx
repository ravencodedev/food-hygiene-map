import GeoJSON, { Feature, FeatureCollection } from 'geojson'
import mapboxgl, { GeoJSONSource, LngLat, Map, MapMouseEvent } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import styled, { createGlobalStyle } from 'styled-components'
import TakeawayIcon from '../assets/images/takeaway-icon.png'

interface EstablishmentProps {
  title: string
  description: string
  rating: string
}

export const MapboxMap = (): JSX.Element => {
  const mapContainer = useRef<HTMLElement | null>(null)
  const [map, setMap] = useState<Map | null>(null)

  const initializeMap = useCallback(async (): Promise<void> => {
    const longitude = -0.118092
    const latitude = 51.509865
    mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_KEY as string
    const initialMap = new mapboxgl.Map({
      container: mapContainer.current as HTMLElement,
      style: `mapbox://styles/ravencode/ck90euxby05sb1jmlipkbxaj7`, //`mapbox://styles/mapbox/streets-v11`,
      center: [longitude, latitude],
      zoom: 9,
    })

    initialMap.addControl(new mapboxgl.NavigationControl())

    initialMap.on('load', () => {
      setMap(initialMap)
      initialMap.resize()
    })
    initialMap.setMaxBounds([
      [-7.57216793459, 49.959999905],
      [1.68153079591, 58.6350001085],
    ])

    const response = await fetch(
      `https://api.ratings.food.gov.uk/Establishments?longitude=${longitude}&latitude=${latitude}`,
      {
        headers: {
          'x-api-version': '2',
        },
      }
    )

    const { establishments } = await response.json()

    const geoJson: FeatureCollection<GeoJSON.Point, EstablishmentProps> = {
      type: 'FeatureCollection',
      features: establishments.map(
        (establishment: {
          BusinessName: string
          RatingValue: string
          geocode: {
            longitude: number
            latitude: number
          }
        }) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [
              establishment.geocode.longitude,
              establishment.geocode.latitude,
            ],
          },
          properties: {
            title: establishment.BusinessName,
            description: '',
            rating: establishment.RatingValue,
          },
        })
      ),
    }

    initialMap.addSource('establishments', {
      type: 'geojson',
      data: geoJson,
      cluster: true,
      clusterRadius: 80,
      clusterMaxZoom: 15,
    })

    initialMap.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'establishments',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#32BF84',
        'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
      },
    })

    initialMap.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'establishments',
      filter: ['has', 'point_count'],
      paint: {
        'text-color': 'white',
      },
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12,
      },
    })

    initialMap.addLayer({
      id: 'marker',
      type: 'symbol',
      source: 'establishments',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': `${TakeawayIcon}`,
        'icon-size': 0.25,
        'text-field': '{title}',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12,
      },
    })

    initialMap.on(
      'click',
      'clusters',
      (
        e: MapMouseEvent & {
          features?: Feature<GeoJSON.Point, EstablishmentProps>[]
        }
      ) => {
        e.preventDefault()
        const features = initialMap.queryRenderedFeatures(e.point, {
          layers: ['clusters'],
        })
        if (features && features.length) {
          const [feature] = features

          if (feature.properties) {
            const clusterId = feature.properties.clusterId
            const [
              longitude,
              latitude,
            ] = (feature.geometry as GeoJSON.Point).coordinates
            ;(initialMap.getSource(
              'establishments'
            ) as GeoJSONSource).getClusterExpansionZoom(clusterId, (err) => {
              const lngLat = new LngLat(longitude, latitude)
              if (err) return
              initialMap.easeTo({
                center: lngLat,
                zoom: initialMap.getZoom() + 1,
              })
            })
          }
        }
      }
    )

    initialMap.on(
      'click',
      'marker',
      (
        e: MapMouseEvent & {
          features?: Feature<GeoJSON.Point, EstablishmentProps>[]
        }
      ) => {
        e.preventDefault()
        if (e.features) {
          const [feature] = e.features
          const {
            properties: { title, description, rating },
          } = feature
          const coordinates = feature.geometry.coordinates.slice()

          while (Math.abs(e.lngLat.lng - coordinates[0]) > 100) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360
          }
          const [longitude, latitude] = coordinates
          new mapboxgl.Popup({ offset: 25 })
            .setLngLat(new LngLat(longitude, latitude))
            .setHTML(
              `<h3>${title}</h3><p>${description}</p><p><strong>Rating:</strong> ${rating}</p>`
            )
            .addTo(initialMap)
        }
      }
    )

    initialMap.on('mouseenter', 'clusters', () => {
      initialMap.getCanvas().style.cursor = 'pointer'
    })

    initialMap.on('mouseleave', 'cluster', () => {
      initialMap.getCanvas().style.cursor = ''
    })
  }, [])

  useEffect(() => {
    if (!map) {
      initializeMap()
    }
  }, [map, initializeMap])

  return (
    <>
      <GlobalStyle />
      <MapContainer ref={(el) => (mapContainer.current = el)}></MapContainer>
    </>
  )
}

const GlobalStyle = createGlobalStyle`
  .mapboxgl-popup {
    max-width: 200px;
  }

  .mapboxgl-popup-content {
    text-align: center;
    font-family: 'Open Sans', sans-serif;
  }

  .marker {
    background-image: url(${TakeawayIcon});
    background-size: cover;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    cursor: pointer;
  }
`

const MapContainer = styled.div`
  height: calc(100vh - 80px);
  position: absolute;
  width: 100vw;
`
